import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/equipamentos/$slug")({
  head: () => ({
    meta: [
      { title: "Equipamento — SetupSocial" },
      { name: "description", content: "Opiniões e experiências reais de quem possui este equipamento." },
      { property: "og:title", content: "Equipamento — SetupSocial" },
      { property: "og:description", content: "Opiniões de proprietários reais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, specs, specs_verified, is_demo, category:categories(name), manufacturer:manufacturers(name)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: owners } = await supabase
        .from("user_devices")
        .select("user_id, profile:profiles!inner(username, display_name)")
        .eq("product_id", data.id)
        .limit(20);
      return { ...data, owners: owners ?? [] };
    },
  });
  if (q.isLoading) return <AppShell><div className="h-40 animate-pulse rounded-xl bg-card" /></AppShell>;
  if (!q.data)
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-6 text-center">
          Equipamento não encontrado. <Link to="/equipamentos" className="text-lavender hover:underline">Ver catálogo</Link>
        </div>
      </AppShell>
    );
  const p: any = q.data;
  const specs = Object.entries(p.specs ?? {});
  return (
    <AppShell>
      <section className="mb-4 rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">{p.manufacturer?.name} · {p.category?.name}</p>
        <h1 className="mt-1 text-2xl font-bold">{p.name}</h1>
        {p.is_demo && <p className="mt-2 inline-block rounded bg-warning/15 px-2 py-0.5 text-xs text-warning">Dado de demonstração</p>}
        {specs.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {specs.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-secondary px-3 py-2">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        {!p.specs_verified && specs.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Especificações não verificadas.</p>}
        <div className="mt-4">
          <h2 className="text-sm font-semibold">Quem possui ({p.owners.length})</h2>
          {p.owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém cadastrou ainda. Tem um? Adicione em "Minha máquina".</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {p.owners.map((o: any) => (
                <Link key={o.user_id} to="/u/$username" params={{ username: o.profile.username }} className="rounded-full bg-secondary px-3 py-1 text-sm hover:text-lavender">
                  @{o.profile.username}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <h2 className="mb-3 text-lg font-semibold">Publicações sobre este equipamento</h2>
      <FeedList filter={{ kind: "product", productId: p.id }} empty="Nenhuma publicação sobre este equipamento ainda." />
    </AppShell>
  );
}
