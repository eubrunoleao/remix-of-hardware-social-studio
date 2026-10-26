import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { normalizeHashtag } from "@/lib/hashtags";

export const Route = createFileRoute("/explorar")({
  head: () => ({
    meta: [
      { title: "Explorar — SetupSocial" },
      { name: "description", content: "Descubra hashtags e pessoas que falam sobre hardware e periféricos." },
      { property: "og:title", content: "Explorar — SetupSocial" },
      { property: "og:description", content: "Hashtags e pessoas da comunidade de hardware." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Explore,
});

function Explore() {
  const [q, setQ] = useState("");
  const term = q.trim();
  const tags = useQuery({
    queryKey: ["tags", term],
    queryFn: async () => {
      let r = supabase.from("hashtags").select("tag, label, post_hashtags(count)").limit(40);
      if (term) r = r.ilike("tag", `%${normalizeHashtag(term)}%`);
      const { data, error } = await r;
      if (error) throw error;
      return (data ?? []).map((t: any) => ({ ...t, n: t.post_hashtags?.[0]?.count ?? 0 })).sort((a, b) => b.n - a.n);
    },
  });
  const people = useQuery({
    queryKey: ["people", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const safe = term.replace(/[%,()]/g, "");
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name")
        .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Explorar</h1>
      <input aria-label="Buscar hashtags e pessoas" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar hashtags ou pessoas…" className="mb-5 h-10 w-full rounded-md border bg-card px-3 text-sm" />
      {term.length >= 2 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Pessoas</h2>
          {people.data?.length === 0 && <p className="text-sm text-muted-foreground">Ninguém encontrado.</p>}
          <div className="flex flex-wrap gap-2">
            {people.data?.map((p) => (
              <Link key={p.username} to="/u/$username" params={{ username: p.username }} className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary">
                {p.display_name} <span className="text-muted-foreground">@{p.username}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Hashtags</h2>
      {tags.isLoading && <div className="h-24 animate-pulse rounded-xl bg-card" />}
      {tags.isError && <p className="text-destructive">Erro ao carregar hashtags.</p>}
      {tags.data?.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Nenhuma hashtag encontrada.</p>}
      <div className="flex flex-wrap gap-2">
        {tags.data?.map((t: any) => (
          <Link key={t.tag} to="/tag/$tag" params={{ tag: t.tag }} className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-accent">
            <span className="text-lavender">#{t.label || t.tag}</span> <span className="text-xs text-muted-foreground">{t.n}</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
