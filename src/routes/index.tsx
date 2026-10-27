import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostComposer } from "@/components/PostComposer";
import { FeedList } from "@/components/FeedList";
import { useAuth } from "@/lib/auth";
import type { FeedFilter } from "@/lib/posts";

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

const SORTS: { key: string; label: string; filter: FeedFilter; needsAuth?: boolean }[] = [
  { key: "recentes", label: "Recentes", filter: { kind: "all" } },
  { key: "seguindo", label: "Seguindo", filter: { kind: "following" }, needsAuth: true },
  { key: "para-voce", label: "Para você", filter: { kind: "foryou" }, needsAuth: true },
  { key: "uteis", label: "Mais úteis", filter: { kind: "useful" } },
];

const EMPTY: Record<string, string> = {
  recentes: "O feed está vazio. Faça a primeira publicação!",
  seguindo: "Você ainda não segue ninguém nem nenhum canal. Explore e siga para ver publicações aqui.",
  "para-voce": "Curta ou salve publicações para a gente entender seus interesses.",
  uteis: "Nenhuma avaliação publicada ainda.",
};

function Index() {
  const { userId } = useAuth();
  const [sort, setSort] = useState("recentes");
  const current = SORTS.find((s) => s.key === sort) ?? SORTS[0]!;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm" role="tablist" aria-label="Ordenação do feed">
          {SORTS.map((s) => {
            const disabled = s.needsAuth && !userId;
            const active = sort === s.key;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={active}
                disabled={disabled}
                title={disabled ? "Entre para usar esta ordenação" : undefined}
                onClick={() => setSort(s.key)}
                className={
                  active
                    ? "rounded-full bg-secondary px-3 py-1 font-medium"
                    : "rounded-full px-3 py-1 text-muted-foreground hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <PostComposer />
        <FeedList key={sort} filter={current.filter} empty={EMPTY[sort] ?? "Nada por aqui ainda."} />
      </div>
    </AppShell>
  );
}
