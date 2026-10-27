import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Channel = { id: string; slug: string; name: string; description: string | null };

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, slug, name, description, channel_follows(count)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((c: any) => ({ ...c, followers: c.channel_follows?.[0]?.count ?? 0 })) as (Channel & {
        followers: number;
      })[];
    },
  });
}

export function useChannel(slug: string) {
  return useQuery({
    queryKey: ["channel", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, slug, name, description, channel_follows(count)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, followers: (data as any).channel_follows?.[0]?.count ?? 0 } as Channel & { followers: number }) : null;
    },
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slug: string; name: string; description: string }) => {
      const { error } = await supabase.rpc("create_channel", {
        _slug: input.slug,
        _name: input.name,
        _description: input.description,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}

export function useMyChannelFollows() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["channel-follows", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("channel_follows").select("channel_id").eq("user_id", userId!);
      if (error) throw error;
      return new Set(data.map((r) => r.channel_id));
    },
  });
}

export function useToggleChannelFollow() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ channelId, on }: { channelId: string; on: boolean }) => {
      if (!userId) throw new Error("Faça login primeiro");
      const res = on
        ? await supabase.from("channel_follows").insert({ channel_id: channelId, user_id: userId })
        : await supabase.from("channel_follows").delete().eq("channel_id", channelId).eq("user_id", userId);
      if (res.error && res.error.code !== "23505") throw res.error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["channel-follows"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
      qc.invalidateQueries({ queryKey: ["channel"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useFollowState(otherId: string | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["follow-state", userId, otherId],
    enabled: !!userId && !!otherId && userId !== otherId,
    queryFn: async () => {
      const [f, m, b] = await Promise.all([
        supabase.from("follows").select("followee_id").eq("follower_id", userId!).eq("followee_id", otherId!).maybeSingle(),
        supabase.from("mutes").select("muted_id").eq("user_id", userId!).eq("muted_id", otherId!).maybeSingle(),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", userId!).eq("blocked_id", otherId!).maybeSingle(),
      ]);
      return { following: !!f.data, muted: !!m.data, blocked: !!b.data };
    },
  });
}

export function useFollowCounts(profileId: string | undefined) {
  return useQuery({
    queryKey: ["follow-counts", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [ers, ing] = await Promise.all([
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", profileId!),
        supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", profileId!),
      ]);
      return { followers: ers.count ?? 0, following: ing.count ?? 0 };
    },
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ otherId, on }: { otherId: string; on: boolean }) => {
      if (!userId) throw new Error("Faça login primeiro");
      const res = on
        ? await supabase.from("follows").insert({ follower_id: userId, followee_id: otherId })
        : await supabase.from("follows").delete().eq("follower_id", userId).eq("followee_id", otherId);
      if (res.error && res.error.code !== "23505") throw res.error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["follow-state"] });
      qc.invalidateQueries({ queryKey: ["follow-counts"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useToggleMuteBlock(table: "mutes" | "blocks") {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ otherId, on }: { otherId: string; on: boolean }) => {
      if (!userId) throw new Error("Faça login primeiro");
      const res =
        table === "mutes"
          ? on
            ? await supabase.from("mutes").insert({ user_id: userId, muted_id: otherId })
            : await supabase.from("mutes").delete().eq("user_id", userId).eq("muted_id", otherId)
          : on
            ? await supabase.from("blocks").insert({ blocker_id: userId, blocked_id: otherId })
            : await supabase.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", otherId);
      if (res.error && res.error.code !== "23505") throw res.error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["follow-state"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export type Conversation = {
  id: string;
  accepted: boolean;
  requester_id: string;
  created_at: string;
  other: { id: string; username: string; display_name: string } | null;
  lastMessage: { body: string; created_at: string; sender_id: string } | null;
};

export function useConversations() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["conversations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("id, accepted, requester_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!convs.length) return [] as Conversation[];
      const ids = convs.map((c) => c.id);
      const [parts, msgs] = await Promise.all([
        supabase.from("conversation_participants").select("conversation_id, user_id, profile:profiles(username, display_name)").in("conversation_id", ids),
        supabase.from("messages").select("conversation_id, body, created_at, sender_id").in("conversation_id", ids).order("created_at", { ascending: false }).limit(200),
      ]);
      if (parts.error) throw parts.error;
      if (msgs.error) throw msgs.error;
      return convs.map((c) => {
        const other = (parts.data ?? []).find((p) => p.conversation_id === c.id && p.user_id !== userId);
        const last = (msgs.data ?? []).find((m) => m.conversation_id === c.id) ?? null;
        return {
          ...c,
          other: other ? { id: other.user_id, ...(other as any).profile } : null,
          lastMessage: last,
        } as Conversation;
      });
    },
  });
}

export function useConversation(id: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["conversation", id],
    enabled: !!userId,
    queryFn: async () => {
      const { data: c, error } = await supabase.from("conversations").select("id, accepted, requester_id, created_at").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!c) return null;
      const { data: parts, error: pErr } = await supabase
        .from("conversation_participants")
        .select("user_id, profile:profiles(username, display_name)")
        .eq("conversation_id", id);
      if (pErr) throw pErr;
      const other = (parts ?? []).find((p) => p.user_id !== userId);
      return { ...c, other: other ? { id: other.user_id, ...(other as any).profile } : null } as Conversation;
    },
  });
}

export function useMessages(conversationId: string) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, body, sender_id, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at")
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`messages-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", conversationId] });
          qc.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, qc]);

  return q;
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc("send_message", { _conversation_id: conversationId, _body: body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useStartConversation() {
  return useMutation({
    mutationFn: async (otherId: string) => {
      const { data, error } = await supabase.rpc("create_conversation", { _other_user: otherId });
      if (error) throw error;
      return data as string;
    },
  });
}

export function useRespondConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_conversation", { _conversation_id: id, _accept: accept });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation"] });
    },
  });
}
