import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, VolumeX, Volume2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { MachineEditor } from "@/components/MachineEditor";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFollowCounts, useFollowState, useStartConversation, useToggleFollow, useToggleMuteBlock } from "@/lib/social";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — SetupSocial` },
      { name: "description", content: `Perfil e setup de @${params.username} no SetupSocial.` },
      { property: "og:title", content: `@${params.username} — SetupSocial` },
      { property: "og:description", content: `Veja a máquina e as publicações de @${params.username}.` },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { username } = Route.useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const q = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username, display_name, bio, created_at").eq("username", username).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ display_name: name.trim(), bio: bio.trim() || null }).eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("Verifique os campos (nome até 50, bio até 280 caracteres)"),
  });

  if (q.isLoading) return <AppShell><div className="h-40 animate-pulse rounded-xl bg-card" /></AppShell>;
  if (!q.data)
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-6 text-center">Perfil não encontrado. <Link to="/" className="text-lavender hover:underline">Início</Link></div>
      </AppShell>
    );
  const p = q.data;
  const isMe = p.id === userId;
  return <ProfileBody p={p} isMe={isMe} userId={userId} editing={editing} setEditing={setEditing} name={name} setName={setName} bio={bio} setBio={setBio} save={save} navigate={navigate} />;
}

function ProfileBody({ p, isMe, userId, editing, setEditing, name, setName, bio, setBio, save, navigate }: any) {
  const followState = useFollowState(isMe ? undefined : p.id);
  const counts = useFollowCounts(p.id);
  const toggleFollow = useToggleFollow();
  const toggleMute = useToggleMuteBlock("mutes");
  const startConv = useStartConversation();
  return (
    <AppShell>
      <section className="mb-4 rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-brand font-display text-2xl font-bold text-primary-foreground">
            {p.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
                <input aria-label="Nome" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" />
                <textarea aria-label="Bio" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} placeholder="Sobre você e seu setup" className="min-h-20 rounded-md border bg-background p-3 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" type="submit" disabled={save.isPending || !name.trim()}>Salvar</Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancelar</Button>
                </div>
              </form>
            ) : (
              <>
                <h1 className="text-xl font-bold">{p.display_name}</h1>
                <p className="text-sm text-muted-foreground">@{p.username}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {counts.data?.followers ?? 0} seguidores · {counts.data?.following ?? 0} seguindo
                </p>
                {p.bio && <p className="mt-2 text-sm">{p.bio}</p>}
                {isMe && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => { setName(p.display_name); setBio(p.bio ?? ""); setEditing(true); }}>
                    Editar perfil
                  </Button>
                )}
                {!isMe && userId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={followState.data?.following ? "secondary" : "default"}
                      disabled={toggleFollow.isPending}
                      onClick={() => toggleFollow.mutate({ otherId: p.id, on: !followState.data?.following })}
                    >
                      {followState.data?.following ? "Seguindo" : "Seguir"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={startConv.isPending}
                      onClick={() =>
                        startConv.mutate(p.id, {
                          onSuccess: (id) => navigate({ to: "/mensagens/$id", params: { id } }),
                          onError: () => toast.error("Não foi possível iniciar a conversa"),
                        })
                      }
                    >
                      <MessageSquare /> Mensagem
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={followState.data?.muted ? "Deixar de silenciar" : "Silenciar"}
                      disabled={toggleMute.isPending}
                      onClick={() => {
                        const on = !followState.data?.muted;
                        toggleMute.mutate({ otherId: p.id, on }, { onSuccess: () => toast.success(on ? "Usuário silenciado" : "Silêncio removido") });
                      }}
                    >
                      {followState.data?.muted ? <Volume2 /> : <VolumeX />}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="mt-5 md:hidden lg:block">
          <h2 className="mb-2 text-sm font-semibold">Máquina</h2>
          <MachineEditor userId={p.id} editable={isMe} />
        </div>
      </section>
      <FeedList filter={{ kind: "author", authorId: p.id }} empty="Nenhuma publicação ainda." />
    </AppShell>
  );
}
