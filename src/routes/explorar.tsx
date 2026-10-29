
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { supabase } from "@/integrations/supabase/client";
import { normalizeHashtag } from "@/lib/hashtags";

export const Route = createFileRoute("/explorar")({
  head: () => ({
    meta: [
      { title: "Explorar — SetupSocial" },
      {
        name: "description",
        content:
          "Encontre pessoas, hashtags e setups com os mesmos componentes.",
      },
    ],
  }),
  component: Explore,
});

type MachineMatch = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  matched_components: string[];
};

function Explore() {
  const [q, setQ] = useState("");
  const term = q.trim().slice(0, 80);
  const enabled = term.length >= 2;

  const tags = useQuery({
    queryKey: ["tags", term],
    queryFn: async () => {
      let request = supabase
        .from("hashtags")
        .select("tag, label, post_hashtags(count)")
        .limit(40);

      if (term) {
        request = request.ilike(
          "tag",
          `%${normalizeHashtag(term)}%`,
        );
      }

      const { data, error } = await request;
      if (error) throw error;

      return (data ?? [])
        .map((tag: any) => ({
          ...tag,
          count: tag.post_hashtags?.[0]?.count ?? 0,
        }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const people = useQuery({
    queryKey: ["people", term],
    enabled,
    queryFn: async () => {
      const safe = term.replace(/[%,()]/g, "");

      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name")
        .or(
          `username.ilike.%${safe}%,display_name.ilike.%${safe}%`,
        )
        .limit(10);

      if (error) throw error;
      return data ?? [];
    },
  });

  const machines = useQuery({
    queryKey: ["machine-search", term],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "search_profiles_by_machine",
        { search_term: term },
      );

      if (error) throw error;
      return (data ?? []) as MachineMatch[];
    },
  });

  return (
    <AppShell>
      <h1 className="mb-2 text-2xl font-bold">Explorar</h1>

      <p className="mb-4 text-sm text-muted-foreground">
        Encontre pessoas pelo nome, por hashtags ou pelas peças
        cadastradas na máquina.
      </p>

      <input
        aria-label="Buscar pessoas, hashtags ou componentes"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Ex.: RTX 3070, Ryzen 5600, mouse..."
        maxLength={80}
        className="mb-6 h-11 w-full rounded-md border bg-card px-3 text-sm"
      />

      {enabled && (
        <>
          <section className="mb-7">
            <h2 className="mb-3 text-lg font-semibold">
              Pessoas com esse componente
            </h2>

            {machines.isLoading && (
              <p className="text-sm text-muted-foreground">
                Procurando nas máquinas cadastradas...
              </p>
            )}

            {machines.isError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <p className="font-medium">
                  Não foi possível pesquisar as máquinas.
                </p>
                <p className="mt-1 break-words">
                  {(() => {
                    const error = machines.error as unknown;
                    if (error instanceof Error) return error.message;
                    if (error && typeof error === "object" && "message" in error) {
                      return String((error as { message: unknown }).message);
                    }
                    if (typeof error === "string") return error;
                    return "Ocorreu um erro inesperado ao consultar o Supabase.";
                  })()}
                </p>
                <button
                  type="button"
                  onClick={() => void machines.refetch()}
                  className="mt-2 rounded-md border px-3 py-1.5 text-foreground hover:bg-muted"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {machines.data?.length === 0 && !machines.isLoading && (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma máquina cadastrada corresponde a essa pesquisa.
              </p>
            )}

            <div className="grid gap-3">
              {machines.data?.map((person) => (
                <Link
                  key={person.id}
                  to="/u/$username"
                  params={{ username: person.username }}
                  className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary"
                >
                  <ProfileAvatar
                    path={person.avatar_path}
                    name={person.display_name}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {person.display_name}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      @{person.username}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {person.matched_components.map((component) => (
                        <span
                          key={component}
                          className="rounded-full border px-2 py-1 text-xs"
                        >
                          {component}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mb-7">
            <h2 className="mb-3 text-lg font-semibold">
              Pessoas
            </h2>

            {people.isError && (
              <p className="text-sm text-destructive">
                Não foi possível carregar as pessoas.
              </p>
            )}

            {people.data?.length === 0 && !people.isLoading && (
              <p className="text-sm text-muted-foreground">
                Nenhum username ou nome corresponde à pesquisa.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {people.data?.map((person) => (
                <Link
                  key={person.username}
                  to="/u/$username"
                  params={{ username: person.username }}
                  className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary"
                >
                  {person.display_name}{" "}
                  <span className="text-muted-foreground">
                    @{person.username}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Hashtags</h2>

        {tags.isLoading && (
          <div className="h-20 animate-pulse rounded-xl bg-card" />
        )}

        {tags.isError && (
          <p className="text-sm text-destructive">
            Erro ao carregar hashtags.
          </p>
        )}

        {tags.data?.length === 0 && !tags.isLoading && (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            Nenhuma hashtag encontrada.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {tags.data?.map((tag: any) => (
            <Link
              key={tag.tag}
              to="/tag/$tag"
              params={{ tag: tag.tag }}
              className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-accent"
            >
              <span className="text-lavender">
                #{tag.label || tag.tag}
              </span>{" "}
              <span className="text-xs text-muted-foreground">
                {tag.count}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
