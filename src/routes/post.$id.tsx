import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { useMyInteractions, useFeed } from "@/lib/posts";

export const Route = createFileRoute("/post/$id")({
  head: () => ({
    meta: [
      { title: "Publicação — SetupSocial" },
      { name: "description", content: "Veja esta publicação sobre hardware no SetupSocial." },
      { property: "og:title", content: "Publicação — SetupSocial" },
      { property: "og:description", content: "Uma experiência real com hardware." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const feed = useFeed({ kind: "post", id } as never);
  void useQuery;
  const post = feed.data?.pages[0]?.posts[0];
  const mine = useMyInteractions(post ? [post.id] : []);
  return (
    <AppShell>
      {feed.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-card" />
      ) : post ? (
        <PostCard post={post} liked={!!mine.data?.liked.has(post.id)} saved={!!mine.data?.saved.has(post.id)} />
      ) : (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p>Publicação não encontrada ou removida.</p>
          <Link to="/" className="mt-2 inline-block text-lavender hover:underline">Voltar ao início</Link>
        </div>
      )}
    </AppShell>
  );
}
