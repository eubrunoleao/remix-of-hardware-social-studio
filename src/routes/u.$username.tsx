import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, MessageSquare, VolumeX, Volume2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { MachineEditor } from "@/components/MachineEditor";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { normalizeUsername, validUsername } from "@/lib/profile";
import { validateImage } from "@/lib/images";
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
  const [handle, setHandle] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const q = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username, display_name, bio, created_at, avatar_path").eq("username", username).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!userId || q.data?.id !== userId) throw new Error("Entre para editar seu perfil");
      const nextHandle = normalizeUsername(handle);
      if (!validUsername(nextHandle)) throw new Error("Use de 3 a 24 letras minúsculas, números ou _ no nome de usuário");
      let avatarPath = q.data.avatar_path;
      let uploaded: string | null = null;
      if (photo) {
        const issue = validateImage(photo);
        if (issue) throw new Error(issue);
        const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
        uploaded = `${userId}/${crypto.randomUUID()}.${extensions[photo.type]}`;
        const { error } = await supabase.storage.from("profile-photos").upload(uploaded, photo, { contentType: photo.type });
        if (error) throw new Error("Não foi possível enviar a foto");
        avatarPath = uploaded;
      }
      const { error } = await supabase.from("profiles").update({ username: nextHandle, display_name: name.trim(), bio: bio.trim() || null, avatar_path: avatarPath }).eq("id", userId).select("id").single();
      if (error) {
        if (uploaded) await supabase.storage.from("profile-photos").remove([uploaded]);
        throw new Error(error.code === "23505" ? "Esse nome de usuário já está em uso" : "Não foi possível salvar o perfil");
      }
      if (uploaded && q.data.avatar_path) await supabase.storage.from("profile-photos").remove([q.data.avatar_path]);
      return nextHandle;
    },
    onSuccess: async (nextHandle) => {
      setEditing(false);
      setPhoto(null);
      toast.success("Perfil atualizado");
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["feed"] })]);
      navigate({ to: "/u/$username", params: { username: nextHandle }, replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (q.isLoading) return <AppShell><div className="h-40 animate-pulse rounded-xl bg-card" /></AppShell>;
  if (q.isError) return <AppShell><p className="text-destructive">Não foi possível carregar o perfil.</p><Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button></AppShell>;
  if (!q.data)
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-6 text-center">Perfil não encontrado. <Link to="/" className="text-lavender hover:underline">Início</Link></div>
      </AppShell>
    );
  const p = q.data;
  const isMe = p.id === userId;
  return <ProfileBody p={p} isMe={isMe} userId={userId} editing={editing} setEditing={setEditing} name={name} setName={setName} bio={bio} setBio={setBio} save={save} navigate={navigate} handle={handle} setHandle={setHandle} photo={photo} setPhoto={setPhoto} preview={preview} />;
}

function ProfileBody({ p, isMe, userId, editing, setEditing, name, setName, bio, setBio, save, navigate, handle, setHandle, setPhoto, preview }: any) {
  const followState = useFollowState(isMe ? undefined : p.id);
  const counts = useFollowCounts(p.id);
  const toggleFollow = useToggleFollow();
  const toggleMute = useToggleMuteBlock("mutes");
  const startConv = useStartConversation();
  return (
    <AppShell>
      <section className="mb-4 rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4">
          {editing && preview ? <img src={preview} alt="Prévia da foto de perfil" className="size-20 shrink-0 rounded-full object-cover" /> : <ProfileAvatar path={p.avatar_path} name={p.display_name} large />}
          <div className="min-w-0 flex-1">
            {editing ? (
              <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
                <label className="grid gap-1 text-xs text-muted-foreground">Nome de usuário
                  <input aria-label="Nome de usuário" value={handle} maxLength={24} onChange={(e) => setHandle(e.target.value)} className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm text-foreground" />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">Foto de perfil
                  <span className="flex items-center gap-2"><Camera className="size-4" /><input type="file" aria-label="Foto de perfil" accept="image/jpeg,image/png,image/webp,image/gif" className="min-w-0 w-full text-xs" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const issue = validateImage(file); if (issue) { toast.error(issue); e.target.value = ""; return; } setPhoto(file); }} /></span>
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">Nome de exibição
                <input aria-label="Nome" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm text-foreground" />
                </label>
                <textarea aria-label="Bio" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} placeholder="Sobre você e seu setup" className="min-h-20 rounded-md border bg-background p-3 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" type="submit" disabled={save.isPending || !name.trim() || !validUsername(normalizeUsername(handle))}>Salvar</Button>
                  <Button size="sm" variant="ghost" type="button" disabled={save.isPending} onClick={() => { setEditing(false); setPhoto(null); }}>Cancelar</Button>
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
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => { setName(p.display_name); setBio(p.bio ?? ""); setHandle(p.username); setPhoto(null); setEditing(true); }}>
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
                      onClick={async () => {
                        try {
                          const id = await startConv.mutateAsync(p.id);
                          if (!id) throw new Error("A conversa não retornou um identificador válido");
                          await navigate({ to: "/mensagens/$id", params: { id } });
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Não foi possível abrir a conversa");
                        }
                      }}
                    >
                      <MessageSquare /> {startConv.isPending ? "Abrindo..." : "Mensagem"}
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
        <div className="mt-5 border-t pt-4">
          <h2 className="mb-3 font-semibold">Minha máquina</h2>
          <MachineEditor userId={p.id} editable={isMe} />
        </div>
      </section>
      <FeedList filter={{ kind: "author", authorId: p.id }} empty="Nenhuma publicação ainda." />
    </AppShell>
  );
}
