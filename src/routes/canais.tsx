import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useChannels, useMyChannelFollows, useToggleChannelFollow } from "@/lib/social";
import { useCreateCreatorChannel } from "@/lib/channels";

export const Route = createFileRoute("/canais")({
  head: () => ({
    meta: [
      { title: "Canais — SetupSocial" },
      { name: "description", content: "Canais de criadores, comunicados e comunidades de hardware." },
      { property: "og:title", content: "Canais — SetupSocial" },
      { property: "og:description", content: "Acompanhe criadores e comunidades de hardware." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Channels,
});

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function CreateChannelForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Hardware");
  const [visibility, setVisibility] = useState("public");
  const [joinApproval, setJoinApproval] = useState(false);
  const create = useCreateCreatorChannel();
  return (
    <form className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const slug = slugify(name);
        if (slug.length < 2) { toast.error("O nome precisa gerar um endereço válido"); return; }
        create.mutate({ slug, name: name.trim(), description: description.trim(), category, visibility, join_approval: joinApproval }, {
          onSuccess: () => { toast.success("Canal criado! Você é o proprietário."); onDone(); },
          onError: (err) => toast.error(err.message.includes("duplicate") ? "Já existe um canal com esse endereço" : err.message || "Não foi possível criar o canal"),
        });
      }}>
      <h2 className="font-semibold">Criar seu canal</h2>
      <input aria-label="Nome do canal" value={name} maxLength={60} onChange={(e) => setName(e.target.value)}
        placeholder="Nome do canal" className="h-10 rounded-md border bg-background px-3 text-sm" required />
      <input aria-label="Descrição" value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição do canal" className="h-10 rounded-md border bg-background px-3 text-sm" />
      <div className="grid gap-2 sm:grid-cols-2">
        <select aria-label="Categoria do canal" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
          {["Hardware","Periféricos","Reviews","Notícias","Tecnologia","Games","Streaming","Eventos","Comunidade","Outros"].map((v) => <option key={v}>{v}</option>)}
        </select>
        <select aria-label="Privacidade do canal" value={visibility} onChange={(e) => { setVisibility(e.target.value); if(e.target.value === "private") setJoinApproval(true); }}
          className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="public">Público — qualquer pessoa pode encontrar</option>
          <option value="private">Privado — entrada controlada</option>
          <option value="exclusive">Exclusivo — acesso aprovado</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={joinApproval} onChange={(e) => setJoinApproval(e.target.checked)} />
        Aprovar manualmente solicitações de entrada
      </label>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={create.isPending || name.trim().length < 2}>{create.isPending ? "Criando…" : "Criar canal"}</Button>
        <Button size="sm" variant="ghost" type="button" onClick={onDone}>Cancelar</Button>
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Canais</h1><p className="text-sm text-muted-foreground">Acompanhe criadores, marcas e comunidades.</p></div>
        {ready && userId && !creating && <Button size="sm" onClick={() => setCreating(true)}>Criar meu canal</Button>}
      </div>
      {creating && <CreateChannelForm onDone={() => setCreating(false)} />}
      {channels.isLoading && <div className="h-40 animate-pulse rounded-xl bg-card" />}
      {channels.isError && <p className="text-destructive">Erro ao carregar canais.</p>}
      <div className="flex flex-col gap-3">
        {channels.data?.map((c) => {
          const following = !!mine.data?.has(c.id);
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground"><Users className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <Link to="/canais/$slug" params={{ slug: c.slug }} className="font-semibold hover:text-lavender">{c.name}</Link>
                {c.description && <p className="truncate text-sm text-muted-foreground">{c.description}</p>}
                <p className="text-xs text-muted-foreground">{c.followers} seguidores</p>
              </div>
              {userId && <Button size="sm" variant={following ? "secondary" : "default"} disabled={toggle.isPending}
                onClick={() => toggle.mutate({ channelId: c.id, on: !following })}>{following ? "Seguindo" : "Seguir"}</Button>}
            </div>
          );
        })}
        {!channels.isLoading && !channels.isError && !channels.data?.length && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Ainda não há canais públicos. Crie o primeiro canal da comunidade.</div>
        )}
      </div>
      {ready && !userId && <p className="mt-4 text-sm text-muted-foreground"><Link to="/auth" className="text-lavender hover:underline">Entre</Link> para seguir canais e criar o seu.</p>}
    </AppShell>
  );
}
