
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

  // One case-insensitive profile query powers both people and equipment results.
  // Matching machine_specs client-side avoids depending on the optional RPC being
  // present in every Lovable preview/backend environment.
  const profilesSearch = useQuery({
    queryKey: ["profile-search", term],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_path, machine_specs")
        .limit(1000);

      if (error) throw error;

      const normalizedTerm = term.toLocaleLowerCase();
      return (data ?? []).map((profile: any) => {
        const specs = profile.machine_specs && typeof profile.machine_specs === "object"
          ? profile.machine_specs
          : {};
        const matchedComponents = Object.entries(specs)
          .filter(([key, value]) => !key.endsWith("_label") && value != null)
          .filter(([key, value]) =>
            `${key} ${String(specs[key.replace(/_value$/, "_label")] ?? "")} ${String(value)}`
              .toLocaleLowerCase()
              .includes(normalizedTerm)
          )
          .map(([key]) => {
            const labels: Record<string, string> = {
              processor: "Processador", motherboard: "Placa-mãe",
              graphics: "Placa de vídeo (GPU)", storage: "Armazenamento (SSD / HD)",
              memory: "Memória RAM", cooling: "Refrigeração", case: "Gabinete",
              power: "Fonte de alimentação", fans: "Ventoinhas e kits de fans",
              monitor: "Monitor", mouse: "Mouse", keyboard: "Teclado",
              mousepad: "Mousepad / deskpad", microphone: "Microfone",
              arm: "Braço articulado", headset: "Fone de ouvido / headset",
              name: "Nome da máquina", system: "Sistema operacional", other: "Outras especificações",
            };
            return labels[key] ?? String(specs[key.replace(/_value$/, "_label")] ?? key);
          });
        const profileText = `${profile.username} ${profile.display_name}`.toLocaleLowerCase();
        return {
          ...profile,
          matched_components: [...new Set(matchedComponents)],
          matchesPerson: profileText.includes(normalizedTerm),
          matchesMachine: matchedComponents.length > 0,
        };
      });
    },
  });

  const people = {
    ...profilesSearch,
    data: profilesSearch.data?.filter((profile: any) => profile.matchesPerson) ?? [],
  };
  const machines = {
    ...profilesSearch,
    data: profilesSearch.data
      ?.filter((profile: any) => profile.matchesMachine)
      .map((profile: any) => ({
        ...profile,
        matched_components: profile.matched_components,
      })) ?? [],
  };

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

            {profilesSearch.isLoading && (
              <p className="text-sm text-muted-foreground">
                Procurando nas máquinas cadastradas...
              </p>
            )}

            {profilesSearch.isError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <p className="font-medium">
                  Não foi possível pesquisar as máquinas.
                </p>
                <p className="mt-1 break-words">
                  {(() => {
                    const error = profilesSearch.error as unknown;
                    if (error instanceof Error) return error.message;
                    if (error && typeof error === "object" && "message" in error) {
                      return String((error as { message: unknown }).message);
                    }
                    if (typeof error === "string") return error;
                    try {
                      const serialized = JSON.stringify(error);
                      if (serialized && serialized !== "{}") return serialized;
                    } catch {
                      // Ignore serialization failures and show the fallback below.
                    }
                    return String(error ?? "Erro sem detalhes retornados pelo Supabase.");
                  })()}
                </p>
                <button
                  type="button"
                  onClick={() => void profilesSearch.refetch()}
                  className="mt-2 rounded-md border px-3 py-1.5 text-foreground hover:bg-muted"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {machines.data?.length === 0 && !profilesSearch.isLoading && (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma máquina ou componente corresponde a essa pesquisa.
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

            {people.data?.length === 0 && !profilesSearch.isLoading && (
              <p className="text-sm text-muted-foreground">
                Nenhum usuário corresponde à pesquisa.
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
