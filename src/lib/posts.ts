import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const PAGE_SIZE = 10;

const POST_SELECT = `id, body, is_review, rating, created_at, author_id,
  author:profiles!posts_author_id_fkey(username, display_name),
  category:categories(slug, name),
  channel:channels(slug, name),
  post_products(product:products(slug, name)),
  post_hashtags(hashtag:hashtags(tag, label)),
  post_images(path, created_at), post_likes(count), comments(count)`;

export type FeedFilter =
  | { kind: "all" }
  | { kind: "following" }
  | { kind: "foryou" }
  | { kind: "useful" }
  | { kind: "tag"; tag: string }
  | { kind: "product"; productId: string }
  | { kind: "channel"; channelId: string }
  | { kind: "author"; authorId: string }
  | { kind: "saved" }
  | { kind: "post"; id: string };

export type FeedPost = {
  id: string;
  body: string;
  is_review: boolean;
  rating: number | null;
  created_at: string;
  author_id: string;
  author: { username: string; display_name: string } | null;
  category: { slug: string; name: string } | null;
  channel: { slug: string; name: string } | null;
  products: { slug: string; name: string }[];
  tags: { tag: string; label: string }[];
  images: string[];
  likeCount: number;
  commentCount: number;
};

async function idsFor(filter: FeedFilter, userId: string | null): Promise<string[] | null> {
  if (filter.kind === "tag") {
    const { data: h } = await supabase.from("hashtags").select("id").eq("tag", filter.tag).maybeSingle();
    if (!h) return [];
    const { data, error } = await supabase.from("post_hashtags").select("post_id").eq("hashtag_id", h.id).limit(500);
    if (error) throw error;
    return data.map((r) => r.post_id);
  }
  if (filter.kind === "product") {
    const { data, error } = await supabase.from("post_products").select("post_id").eq("product_id", filter.productId).limit(500);
    if (error) throw error;
    return data.map((r) => r.post_id);
  }
  if (filter.kind === "saved") {
    if (!userId) return [];
    const { data, error } = await supabase.from("post_saves").select("post_id").eq("user_id", userId).limit(500);
    if (error) throw error;
    return data.map((r) => r.post_id);
  }
  if (filter.kind === "foryou") {
    if (!userId) return null;
    // Posts que usam hashtags de publicações que a pessoa curtiu ou salvou.
    const [likes, saves] = await Promise.all([
      supabase.from("post_likes").select("post_id").eq("user_id", userId).limit(200),
      supabase.from("post_saves").select("post_id").eq("user_id", userId).limit(200),
    ]);
    if (likes.error) throw likes.error;
    if (saves.error) throw saves.error;
    const interacted = [...(likes.data ?? []), ...(saves.data ?? [])].map((r) => r.post_id);
    if (!interacted.length) return [];
    const { data: ph, error: phErr } = await supabase.from("post_hashtags").select("hashtag_id").in("post_id", interacted).limit(200);
    if (phErr) throw phErr;
    const tagIds = [...new Set((ph ?? []).map((r) => r.hashtag_id))];
    if (!tagIds.length) return [];
    const { data, error } = await supabase.from("post_hashtags").select("post_id").in("hashtag_id", tagIds).limit(500);
    if (error) throw error;
    return [...new Set(data.map((r) => r.post_id))].filter((id) => !interacted.includes(id));
  }
  return null;
}

async function mutedIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await supabase.from("mutes").select("muted_id").eq("user_id", userId);
  if (error) throw error;
  return data.map((r) => r.muted_id);
}

export function useFeed(filter: FeedFilter) {
  const { userId } = useAuth();
  return useInfiniteQuery({
    queryKey: ["feed", filter, filter.kind === "saved" || filter.kind === "following" || filter.kind === "foryou" ? userId : null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const [ids, muted] = await Promise.all([idsFor(filter, userId), mutedIds(userId)]);
      if (ids && ids.length === 0) return { posts: [] as FeedPost[], next: null };
      let q = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(PAGE_SIZE);
      if (ids) q = q.in("id", ids);
      if (filter.kind === "post") q = q.eq("id", filter.id);
      if (filter.kind === "author") q = q.eq("author_id", filter.authorId);
      if (filter.kind === "channel") q = q.eq("channel_id", filter.channelId);
      if (filter.kind === "useful") q = q.eq("is_review", true);
      if (filter.kind === "following") {
        if (!userId) return { posts: [] as FeedPost[], next: null };
        const [fol, ch] = await Promise.all([
          supabase.from("follows").select("followee_id").eq("follower_id", userId).limit(500),
          supabase.from("channel_follows").select("channel_id").eq("user_id", userId).limit(200),
        ]);
        if (fol.error) throw fol.error;
        if (ch.error) throw ch.error;
        const authors = (fol.data ?? []).map((r) => r.followee_id);
        const channels = (ch.data ?? []).map((r) => r.channel_id);
        if (!authors.length && !channels.length) return { posts: [] as FeedPost[], next: null };
        const parts: string[] = [];
        if (authors.length) parts.push(`author_id.in.(${authors.join(",")})`);
        if (channels.length) parts.push(`channel_id.in.(${channels.join(",")})`);
        q = q.or(parts.join(","));
      }
      if (filter.kind === "foryou" && userId) q = q.neq("author_id", userId);
      if (muted.length) q = q.not("author_id", "in", `(${muted.join(",")})`);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      let posts: FeedPost[] = (data ?? []).map((p: any) => ({
        id: p.id,
        body: p.body,
        is_review: p.is_review,
        rating: p.rating,
        created_at: p.created_at,
        author_id: p.author_id,
        author: p.author,
        category: p.category,
        channel: p.channel,
        products: (p.post_products ?? []).map((x: any) => x.product).filter(Boolean),
        tags: (p.post_hashtags ?? []).map((x: any) => x.hashtag).filter(Boolean),
        images: (p.post_images ?? []).map((x: any) => x.path),
        likeCount: p.post_likes?.[0]?.count ?? 0,
        commentCount: p.comments?.[0]?.count ?? 0,
      }));
      if (filter.kind === "useful") posts = posts.sort((a, b) => b.likeCount - a.likeCount);
      return { posts, next: posts.length === PAGE_SIZE ? (posts[posts.length - 1]?.created_at ?? null) : null };
    },
    getNextPageParam: (last) => last.next,
  });
}

export function useMyInteractions(postIds: string[]) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["interactions", userId, postIds],
    enabled: !!userId && postIds.length > 0,
    queryFn: async () => {
      const [likes, saves] = await Promise.all([
        supabase.from("post_likes").select("post_id").eq("user_id", userId!).in("post_id", postIds),
        supabase.from("post_saves").select("post_id").eq("user_id", userId!).in("post_id", postIds),
      ]);
      return {
        liked: new Set((likes.data ?? []).map((r) => r.post_id)),
        saved: new Set((saves.data ?? []).map((r) => r.post_id)),
      };
    },
  });
}

export function useToggle(table: "post_likes" | "post_saves") {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ postId, on }: { postId: string; on: boolean }) => {
      if (!userId) throw new Error("Faça login primeiro");
      const res = on
        ? await supabase.from(table).insert({ post_id: postId, user_id: userId })
        : await supabase.from(table).delete().eq("post_id", postId).eq("user_id", userId);
      if (res.error && res.error.code !== "23505") throw res.error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["interactions"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [cats, prods] = await Promise.all([
        supabase.from("categories").select("id, slug, name").order("sort"),
        supabase
          .from("products")
          .select("id, slug, name, specs, specs_verified, is_demo, category_id, manufacturer:manufacturers(name, slug)")
          .order("name"),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      return { categories: cats.data, products: prods.data };
    },
  });
}
