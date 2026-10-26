import { createFileRoute, Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useChannel, useMyChannelFollows, useToggleChannelFollow } from "@/lib/social";

export const Route = createFileRoute("/canais/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Canal ${params.slug} — SetupSocial` },
      { name: "description", content: `Publicações do canal ${params.slug} no SetupSocial.` },
      { property: "og:title", content: `Canal ${params.slug} — SetupSocial` },
      { property: "og:description", content: `Acompanhe as publicações do canal ${params.slug}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChannelPage,
});

function ChannelPage() {
  const { slug } = Route.useParams();
  const { userId } = useAuth();
  const channel = useChannel(slug);
  const mine = useMyChannelFollows();
  const toggle = useToggleChannelFollow();

  if (channel.isLoading)
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-xl bg-card" />
      </AppShell>
    );
  if (!channel.data)
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-6 text-center">
          Canal não encontrado.{" "}
          <Link to="/canais" className="text-lavender hover:underline">
            Ver canais
          </Link>
        </div>
      </AppShell>
    );

  const c = channel.data;
  const following = !!mine.data?.has(c.id);
  return (
    <AppShell>
      <section className="mb-4 flex items-center gap-4 rounded-xl border bg-card p-5">
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-brand text-primary-foreground">
          <Users className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{c.name}</h1>
          {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{c.followers} seguidores</p>
        </div>
        {userId && (
          <Button size="sm" variant={following ? "secondary" : "default"} disabled={toggle.isPending} onClick={() => toggle.mutate({ channelId: c.id, on: !following })}>
            {following ? "Seguindo" : "Seguir"}
          </Button>
        )}
      </section>
      <FeedList filter={{ kind: "channel", channelId: c.id }} empty="Nenhuma publicação neste canal ainda. Ao publicar, escolha este canal no campo Comunidade." />
    </AppShell>
  );
}
