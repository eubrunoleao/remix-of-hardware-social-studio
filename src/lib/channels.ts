import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const db = supabase as any;

export function useChannelWorkspace(slug: string) {
  return useQuery({
    queryKey: ["channel-workspace", slug],
    queryFn: async () => {
      const { data, error } = await db.from("channels")
        .select("id,slug,name,description,created_by,visibility,avatar_url,cover_url,category,allow_member_posts,allow_comments,join_approval,channel_follows(count)")
        .eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data ? { ...data, followers: data.channel_follows?.[0]?.count ?? 0 } : null;
    },
  });
}

export function useChannelMembership(channelId?: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["channel-membership", channelId, userId],
    enabled: !!channelId && !!userId,
    queryFn: async () => {
      const { data, error } = await db.from("channel_members")
        .select("role,status,notifications_enabled").eq("channel_id", channelId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useChannelMembers(channelId?: string, enabled = false) {
  return useQuery({
    queryKey: ["channel-members", channelId],
    enabled: !!channelId && enabled,
    queryFn: async () => {
      const { data, error } = await db.from("channel_members")
        .select("user_id,role,status,joined_at,profile:profiles(username,display_name,avatar_path)")
        .eq("channel_id", channelId).order("joined_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useJoinChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data, error } = await db.rpc("join_channel", { _channel_id: channelId });
      if (error) throw error;
      return data as string;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["channel-membership"] });
      qc.invalidateQueries({ queryKey: ["channel-members"] });
      qc.invalidateQueries({ queryKey: ["channel-follows"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
      qc.invalidateQueries({ queryKey: ["channel-workspace"] });
    },
  });
}

export function useLeaveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await db.rpc("leave_channel", { _channel_id: channelId });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["channel-membership"] });
      qc.invalidateQueries({ queryKey: ["channel-follows"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Record<string, unknown> }) => {
      const { error } = await db.from("channels").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["channel-workspace"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
      qc.invalidateQueries({ queryKey: ["channel"] });
    },
  });
}

export function useChannelMessages(channelId?: string, enabled = false) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["channel-messages", channelId],
    enabled: !!channelId && enabled,
    queryFn: async () => {
      const { data, error } = await db.from("channel_messages")
        .select("id,body,author_id,created_at,profile:profiles(username,display_name,avatar_path)")
        .eq("channel_id", channelId).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!channelId || !enabled) return;
    const realtime = supabase.channel("channel-messages-" + channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_messages", filter: "channel_id=eq." + channelId }, () => {
        qc.invalidateQueries({ queryKey: ["channel-messages", channelId] });
      }).subscribe();
    return () => { void supabase.removeChannel(realtime); };
  }, [channelId, enabled, qc]);
  return q;
}

export function useSendChannelMessage(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await db.rpc("post_channel_message", { _channel_id: channelId, _body: body });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channel-messages", channelId] }),
  });
}

export function useManageChannelMember(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, action, role }: { userId: string; action: "approve" | "remove" | "ban" | "role"; role?: string }) => {
      const { error } = await db.rpc("manage_channel_member", {
        _channel_id: channelId, _user_id: userId, _action: action, _role: role ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["channel-members", channelId] });
      qc.invalidateQueries({ queryKey: ["channel-membership", channelId] });
      qc.invalidateQueries({ queryKey: ["channel-messages", channelId] });
    },
  });
}

export function useToggleChannelNotifications(channelId: string, enabled: boolean) {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) throw new Error("Faça login primeiro");
      const { error } = await db.from("channel_members").update({ notifications_enabled: next })
        .eq("channel_id", channelId).eq("user_id", userId);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["channel-membership", channelId] }),
  });
}
