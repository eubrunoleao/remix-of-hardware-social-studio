import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useCatalog } from "@/lib/posts";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/equipamentos")({
  head: () => ({
    meta: [
      { title: "Equipamentos — SetupSocial" },
      { name: "description", content: "Catálogo de GPUs, CPUs, periféricos, consoles e celulares com opiniões de quem tem." },
      { property: "og:title", content: "Equipamentos — SetupSocial" },
      { property: "og:description", content: "Catálogo pesquisável de hardware e periféricos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const cat = useCatalog();
  const [q, setQ] = useState("");
  const [c, setC] = useState("");
  const term = q.trim().toLowerCase();
  const list = (cat.data?.products ?? []).filter(
    (p: any) =>
      (!c || p.category_id === c) &&
      (!term || p.name.toLowerCase().includes(term) || p.manufacturer?.name.toLowerCase().includes(term)),
  );
  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Equipamentos</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Catálogo de demonstração — especificações ainda não verificadas.
      </p>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Buscar equipamento"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por modelo ou fabricante…"
          className="h-10 flex-1 rounded-md border bg-card px-3 text-sm"
        />
        <select aria-label="Filtrar categoria" value={c} onChange={(e) => setC(e.target.value)} className="h-10 rounded-md border bg-card px-2 text-sm">
          <option value="">Todas as categorias</option>
          {cat.data?.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      {cat.isLoading && <div className="h-40 animate-pulse rounded-xl bg-card" />}
      {cat.isError && (
        <div className="rounded-xl border bg-card p-6 text-center">
          Erro ao carregar o catálogo. <Button variant="outline" size="sm" onClick={() => cat.refetch()}>Tentar novamente</Button>
        </div>
      )}
      {cat.data && list.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Nenhum equipamento encontrado.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((p: any) => (
          <li key={p.id}>
            <Link to="/equipamentos/$slug" params={{ slug: p.slug }} className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary">
              <p className="text-xs text-muted-foreground">{p.manufacturer?.name} · {cat.data?.categories.find((x) => x.id === p.category_id)?.name}</p>
              <p className="mt-1 font-semibold">{p.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
