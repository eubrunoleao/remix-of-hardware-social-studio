import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const PAGE_SIZE = 10;

const POST_SELECT = `id, body, is_review, rating, created_at, author_id,
  author:profiles!posts_author_id_fkey(username, display_name),
  category:categories(slug, name),
  post_products(product:products(slug, name)),
  post_hashtags(hashtag:hashtags(tag, label)),
  post_likes(count), comments(count)`;

export type FeedFilter =
  | { kind: "all" }
  | { kind: "tag"; tag: string }
  | { kind: "product"; productId: string }
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
  products: { slug: string; name: string }[];
  tags: { tag: string; label: string }[];
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
  return null;
}

export function useFeed(filter: FeedFilter) {
  const { userId } = useAuth();
  return useInfiniteQuery({
    queryKey: ["feed", filter, filter.kind === "saved" ? userId : null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const ids = await idsFor(filter, userId);
      if (ids && ids.length === 0) return { posts: [] as FeedPost[], next: null };
      let q = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(PAGE_SIZE);
      if (ids) q = q.in("id", ids);
      if (filter.kind === "post") q = q.eq("id", filter.id);
      if (filter.kind === "author") q = q.eq("author_id", filter.authorId);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      const posts: FeedPost[] = (data ?? []).map((p: any) => ({
        id: p.id,
        body: p.body,
        is_review: p.is_review,
        rating: p.rating,
        created_at: p.created_at,
        author_id: p.author_id,
        author: p.author,
        category: p.category,
        products: (p.post_products ?? []).map((x: any) => x.product).filter(Boolean),
        tags: (p.post_hashtags ?? []).map((x: any) => x.hashtag).filter(Boolean),
        likeCount: p.post_likes?.[0]?.count ?? 0,
        commentCount: p.comments?.[0]?.count ?? 0,
      }));
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
