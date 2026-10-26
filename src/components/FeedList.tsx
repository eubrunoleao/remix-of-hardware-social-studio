import { Link } from "@tanstack/react-router";
import { useFeed, useMyInteractions, type FeedFilter } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";

export function FeedList({ filter, empty }: { filter: FeedFilter; empty?: string }) {
  const feed = useFeed(filter);
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];
  const mine = useMyInteractions(posts.map((p) => p.id));

  if (feed.isLoading)
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    );
  if (feed.isError)
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-6 text-center">
        <p className="font-medium">Não foi possível carregar as publicações.</p>
        <Button className="mt-3" variant="outline" onClick={() => feed.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (posts.length === 0)
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">{empty ?? "Nada por aqui ainda."}</p>
        <Link to="/equipamentos" className="mt-2 inline-block text-sm text-lavender hover:underline">
          Explorar equipamentos
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} liked={!!mine.data?.liked.has(p.id)} saved={!!mine.data?.saved.has(p.id)} />
      ))}
      {feed.hasNextPage && (
        <Button variant="outline" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
          {feed.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
        </Button>
      )}
    </div>
  );
}
