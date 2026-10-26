import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useChannels, useCreateChannel, useMyChannelFollows, useToggleChannelFollow } from "@/lib/social";

export const Route = createFileRoute("/canais")({
  head: () => ({
    meta: [
      { title: "Canais — SetupSocial" },
      { name: "description", content: "Comunidades temáticas sobre hardware, setups, games e ajuda técnica." },
      { property: "og:title", content: "Canais — SetupSocial" },
      { property: "og:description", content: "Comunidades temáticas sobre hardware e tecnologia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Channels,
});

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function CreateChannelForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateChannel();
  return (
    <form
      className="mb-5 flex flex-col gap-2 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const slug = slugify(name);
        if (slug.length < 2) {
          toast.error("O nome precisa gerar um endereço válido");
          return;
        }
        create.mutate(
          { slug, name: name.trim(), description: description.trim() },
          {
            onSuccess: () => {
              toast.success("Canal criado!");
              onDone();
            },
            onError: (err) => toast.error(err.message.includes("duplicate") ? "Já existe um canal com esse nome" : "Não foi possível criar o canal"),
          },
        );
      }}
    >
      <input aria-label="Nome do canal" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Nome do canal" className="h-9 rounded-md border bg-background px-3 text-sm" />
      <input aria-label="Descrição" value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" className="h-9 rounded-md border bg-background px-3 text-sm" />
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={create.isPending || name.trim().length < 2}>
          {create.isPending ? "Criando…" : "Criar canal"}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Channels() {
  const { userId, ready } = useAuth();
  const channels = useChannels();
  const mine = useMyChannelFollows();
  const toggle = useToggleChannelFollow();
  const [creating, setCreating] = useState(false);

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Canais</h1>
        {ready && userId && !creating && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            Criar canal
          </Button>
        )}
      </div>
      {creating && <CreateChannelForm onDone={() => setCreating(false)} />}
      {channels.isLoading && <div className="h-40 animate-pulse rounded-xl bg-card" />}
      {channels.isError && <p className="text-destructive">Erro ao carregar canais.</p>}
      <div className="flex flex-col gap-3">
        {channels.data?.map((c) => {
          const following = !!mine.data?.has(c.id);
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground">
                <Users className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Link to="/canais/$slug" params={{ slug: c.slug }} className="font-semibold hover:text-lavender">
                  {c.name}
                </Link>
                {c.description && <p className="truncate text-sm text-muted-foreground">{c.description}</p>}
                <p className="text-xs text-muted-foreground">{c.followers} seguidores</p>
              </div>
              {userId && (
                <Button
                  size="sm"
                  variant={following ? "secondary" : "default"}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ channelId: c.id, on: !following })}
                >
                  {following ? "Seguindo" : "Seguir"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {ready && !userId && (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/auth" className="text-lavender hover:underline">
            Entre
          </Link>{" "}
          para seguir canais e criar o seu.
        </p>
      )}
    </AppShell>
  );
}
