import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PostComposer } from "@/components/PostComposer";
import { FeedList } from "@/components/FeedList";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SetupSocial — a rede social do hardware" },
      { name: "description", content: "Encontre quem já tem o equipamento que você quer comprar e leia experiências reais com GPUs, periféricos, consoles e celulares." },
      { property: "og:title", content: "SetupSocial — a rede social do hardware" },
      { property: "og:description", content: "Experiências reais com hardware, periféricos, consoles e celulares." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1 font-medium">Recentes</span>
          <span className="cursor-not-allowed rounded-full px-3 py-1 text-muted-foreground/60" title="Em breve">Seguindo · em breve</span>
        </div>
        <PostComposer />
        <FeedList filter={{ kind: "all" }} empty="O feed está vazio. Faça a primeira publicação!" />
      </div>
    </AppShell>
  );
}
