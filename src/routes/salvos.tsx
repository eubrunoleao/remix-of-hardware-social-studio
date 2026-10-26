import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/salvos")({
  head: () => ({
    meta: [
      { title: "Salvos — SetupSocial" },
      { name: "description", content: "Publicações que você salvou para ler depois." },
      { property: "og:title", content: "Salvos — SetupSocial" },
      { property: "og:description", content: "Publicações salvas no SetupSocial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Saved,
});

function Saved() {
  const { userId, ready } = useAuth();
  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Salvos</h1>
      {!ready ? null : userId ? (
        <FeedList filter={{ kind: "saved" }} empty="Você ainda não salvou nenhuma publicação." />
      ) : (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">
          <Link to="/auth" className="text-lavender hover:underline">Entre</Link> para ver suas publicações salvas.
        </p>
      )}
    </AppShell>
  );
}
