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
      const result = on
        ? await (supabase as any).rpc("join_channel", { _channel_id: channelId })
        : await (supabase as any).rpc("leave_channel", { _channel_id: channelId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["channel-follows"] });
      qc.invalidateQueries({ queryKey: ["channel-membership"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
      qc.invalidateQueries({ queryKey: ["channel"] });
      qc.invalidateQueries({ queryKey: ["channel-workspace"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

