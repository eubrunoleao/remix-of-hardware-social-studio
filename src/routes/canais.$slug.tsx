import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Lock, Globe, Settings, Users, Send, Shield, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";\nimport { PostComposer } from "@/components/PostComposer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  useChannelWorkspace, useChannelMembership, useChannelMembers, useJoinChannel,
  useLeaveChannel, useUpdateChannel, useChannelMessages, useSendChannelMessage,
  useManageChannelMember, useToggleChannelNotifications, useChannelNotifications, useDeleteChannelMessage,
} from "@/lib/channels";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/canais/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Canal ${params.slug} — SetupSocial` },
      { name: "description", content: `Acompanhe o canal ${params.slug} no SetupSocial.` },
      { property: "og:title", content: `Canal ${params.slug} — SetupSocial` },
      { property: "og:description", content: `Publicações e comunidade do canal ${params.slug}.` },
    ],
  }),
  component: ChannelPage,
});

function ChannelPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const channel = useChannelWorkspace(slug);
  const c = channel.data;
  const membership = useChannelMembership(c?.id);
  const role = membership.data?.role as string | undefined;
  const status = membership.data?.status as string | undefined;
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || isOwner;
  const isModerator = isAdmin || role === "moderator";
  const isStaff = isModerator;
  const active = status === "active";
  const members = useChannelMembers(c?.id, isStaff && active);
  const messages = useChannelMessages(c?.id, active);\n  const notificationsFeed = useChannelNotifications(c?.id, active);
  const join = useJoinChannel();
  const leave = useLeaveChannel();
  const update = useUpdateChannel();
  const send = useSendChannelMessage(c?.id ?? "");
  const manage = useManageChannelMember(c?.id ?? "");
  const notifications = useToggleChannelNotifications(c?.id ?? "");
  const deleteMessage = useDeleteChannelMessage(c?.id ?? "");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [allowPosts, setAllowPosts] = useState(false);
  const [allowComments, setAllowComments] = useState(false);
  const [approval, setApproval] = useState(false);\n  const [avatarUrl, setAvatarUrl] = useState("");\n  const [coverUrl, setCoverUrl] = useState("");

  if (channel.isLoading) return <AppShell><div className="h-40 animate-pulse rounded-xl bg-card" /></AppShell>;
  if (!c) return <AppShell><div className="rounded-xl border bg-card p-6 text-center">Canal não encontrado ou você não tem acesso. <Link to="/canais" className="text-lavender hover:underline">Ver canais</Link></div></AppShell>;

  const canWrite = active && (["owner","admin","publisher"].includes(role ?? "") || (c.allow_member_posts && ["member","editor","moderator"].includes(role ?? "")));
  const beginEdit = () => {
    setName(c.name); setDescription(c.description ?? ""); setCategory(c.category ?? "Geral");
    setVisibility(c.visibility); setAllowPosts(c.allow_member_posts); setAllowComments(c.allow_comments); setApproval(c.join_approval);\n    setAvatarUrl(c.avatar_url ?? ""); setCoverUrl(c.cover_url ?? "");
    setEditing(true);
  };
  const saveSettings = () => update.mutate({ id: c.id, changes: {
    name: name.trim(), description: description.trim() || null, category, visibility,
    allow_member_posts: allowPosts, allow_comments: allowComments, join_approval: approval, avatar_url: avatarUrl.trim() || null, cover_url: coverUrl.trim() || null,
  } }, { onSuccess: () => { toast.success("Canal atualizado"); setEditing(false); }, onError: (e) => toast.error(e.message) });

  return (
    <AppShell>
      <div className="mb-3"><Link to="/canais" className="text-sm text-muted-foreground hover:text-foreground">← Todos os canais</Link></div>
      <section className="mb-4 overflow-hidden rounded-xl border bg-card">
        {c.cover_url && <img src={c.cover_url} alt="Capa do canal" className="h-36 w-full object-cover" />}
        <div className="flex flex-wrap items-start gap-4 p-5">
          {c.avatar_url ? <img src={c.avatar_url} alt="" className="size-14 rounded-xl object-cover" /> : <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-brand text-primary-foreground"><Users className="size-6" /></div>}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold">{c.name}</h1>
              <span className="rounded-full border px-2 py-0.5 text-xs">{c.visibility === "public" ? <Globe className="mr-1 inline size-3" /> : <Lock className="mr-1 inline size-3" />}{c.visibility === "public" ? "Público" : c.visibility === "private" ? "Privado" : "Exclusivo"}</span>
              {isOwner && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Proprietário</span>}
            </div>
            {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{c.category} · {c.followers} seguidores</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!userId && <Button asChild size="sm"><Link to="/auth">Entrar para participar</Link></Button>}
            {userId && !status && <Button size="sm" disabled={join.isPending} onClick={() => join.mutate(c.id, { onSuccess: (s) => toast.success(s === "pending" ? "Solicitação enviada para aprovação" : "Você entrou no canal"), onError: (e) => toast.error(e.message) })}>{join.isPending ? "Aguarde…" : c.visibility === "public" && !c.join_approval ? "Participar" : "Solicitar entrada"}</Button>}
            {status === "pending" && <Button size="sm" variant="secondary" disabled>Solicitação pendente</Button>}
            {status === "banned" && <span className="text-sm text-destructive">Você foi bloqueado neste canal.</span>}
            {active && !isOwner && <Button size="sm" variant="outline" onClick={() => leave.mutate(c.id, { onSuccess: () => toast.success("Você saiu do canal"), onError: (e) => toast.error(e.message) })}>Sair do canal</Button>}
            {active && <Button size="icon" variant="ghost" title={membership.data?.notifications_enabled ? "Silenciar notificações" : "Ativar notificações"} onClick={() => notifications.mutate(!membership.data?.notifications_enabled, { onSuccess: () => toast.success("Preferência de notificações atualizada"), onError: (e) => toast.error(e.message) })}>{membership.data?.notifications_enabled ? <Bell className="size-4"/> : <BellOff className="size-4"/>}</Button>}
            {isAdmin && <Button size="sm" variant="outline" onClick={beginEdit}><Settings className="mr-1 size-4"/> Gerenciar canal</Button>}
          </div>
        </div>
      </section>

      {editing && isAdmin && <section className="mb-4 rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">Configurações do canal</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Nome<input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-3"/></label>
          <label className="text-sm">Categoria<input value={category} onChange={(e)=>setCategory(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-3"/></label>
          <label className="text-sm">URL da imagem do canal<input value={avatarUrl} onChange={(e)=>setAvatarUrl(e.target.value)} placeholder="https://..." className="mt-1 h-9 w-full rounded-md border bg-background px-3"/></label>\n          <label className="text-sm">URL da capa<input value={coverUrl} onChange={(e)=>setCoverUrl(e.target.value)} placeholder="https://..." className="mt-1 h-9 w-full rounded-md border bg-background px-3"/></label>\n          <label className="text-sm sm:col-span-2">Descrição<textarea value={description} onChange={(e)=>setDescription(e.target.value)} className="mt-1 min-h-16 w-full rounded-md border bg-background p-2"/></label>
          <label className="text-sm">Visibilidade<select value={visibility} onChange={(e)=>setVisibility(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2"><option value="public">Público</option><option value="private">Privado</option><option value="exclusive">Exclusivo</option></select></label>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={approval} onChange={(e)=>setApproval(e.target.checked)}/> Aprovar entradas manualmente</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={allowPosts} onChange={(e)=>setAllowPosts(e.target.checked)}/> Permitir publicações de membros</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={allowComments} onChange={(e)=>setAllowComments(e.target.checked)}/> Permitir comentários</label>
          </div>
        </div>
        <div className="mt-3 flex gap-2"><Button size="sm" disabled={update.isPending || !name.trim()} onClick={saveSettings}>Salvar alterações</Button><Button size="sm" variant="ghost" onClick={()=>setEditing(false)}>Cancelar</Button></div>
        {isOwner && <Button size="sm" variant="destructive" className="mt-4" onClick={async()=>{if(!confirm("Excluir definitivamente este canal e seu conteúdo?")) return; const {error}=await (supabase as any).from("channels").delete().eq("id",c.id); if(error){toast.error(error.message);return;} toast.success("Canal excluído"); navigate({to:"/canais"});}}><Trash2 className="mr-1 size-4"/> Excluir canal</Button>}
      </section>}

      {isStaff && active && <section className="mb-4 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold"><Shield className="mr-1 inline size-4"/> Administração e membros</h2><span className="text-xs text-muted-foreground">{members.data?.length ?? 0} membros listados</span></div>
        {members.isLoading && <p className="text-sm text-muted-foreground">Carregando membros…</p>}
        <div className="flex flex-col gap-2">
          {members.data?.map((m:any)=>{const profile=m.profile ?? {}; return <div key={m.user_id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.display_name || profile.username || m.user_id.slice(0,8)}</p><p className="text-xs text-muted-foreground">{m.role} · {m.status}</p></div>
            {m.status==="pending" && isAdmin && <Button size="sm" onClick={()=>manage.mutate({userId:m.user_id,action:"approve"},{onSuccess:()=>toast.success("Membro aprovado"),onError:(e)=>toast.error(e.message)})}>Aprovar</Button>}
            {m.role!=="owner" && m.user_id!==userId && <><select aria-label="Alterar função" defaultValue={m.role} disabled={!isAdmin} onChange={(e)=>manage.mutate({userId:m.user_id,action:"role",role:e.target.value},{onSuccess:()=>toast.success("Permissão atualizada"),onError:(err)=>toast.error(err.message)})} className="h-8 rounded border bg-background px-1 text-xs"><option value="member">Membro</option><option value="publisher">Publicador</option><option value="editor">Editor</option><option value="moderator">Moderador</option><option value="analyst">Analista</option>{isOwner && <option value="admin">Administrador</option>}</select>
            <Button size="sm" variant="outline" onClick={()=>manage.mutate({userId:m.user_id,action:"remove"},{onSuccess:()=>toast.success("Membro removido"),onError:(e)=>toast.error(e.message)})}>Remover</Button>
            <Button size="sm" variant="destructive" onClick={()=>manage.mutate({userId:m.user_id,action:"ban"},{onSuccess:()=>toast.success("Membro bloqueado"),onError:(e)=>toast.error(e.message)})}>Bloquear</Button></>}
          </div>})}
        </div>
      </section>}

      {active && <section className="mb-4 rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">Mensagens do canal</h2>
        <div className="mb-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
          {messages.data?.length ? messages.data.map((m:any)=><div key={m.id} className="rounded-lg bg-muted/50 p-3"><p className="mb-1 text-xs font-semibold">{m.profile?.display_name || m.profile?.username || "Membro"} · {new Date(m.created_at).toLocaleString("pt-BR")}</p><div className="flex items-start justify-between gap-2"><p className="whitespace-pre-wrap text-sm">{m.body}</p>{(isModerator || m.author_id===userId) && <button type="button" title="Excluir mensagem" onClick={()=>deleteMessage.mutate(m.id,{onSuccess:()=>toast.success("Mensagem removida"),onError:(e)=>toast.error(e.message)})} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4"/></button>}</div></div>) : <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
        </div>
        {canWrite ? <form className="flex gap-2" onSubmit={(e)=>{e.preventDefault();if(!body.trim())return;send.mutate(body.trim(),{onSuccess:()=>setBody(""),onError:(err)=>toast.error(err.message)});}}><Textarea value={body} onChange={(e)=>setBody(e.target.value)} maxLength={4000} placeholder="Escreva uma mensagem para o canal…" className="min-h-10 flex-1"/><Button type="submit" size="icon" disabled={send.isPending || !body.trim()} aria-label="Enviar mensagem"><Send className="size-4"/></Button></form> : <p className="text-xs text-muted-foreground">Somente administradores podem enviar mensagens neste canal.</p>}
      </section>}

      {canWrite && <div className="mb-4"><PostComposer channelId={c.id} /></div>}\n      {active && <div className="mb-3 flex items-center gap-2"><h2 className="font-semibold">Publicações</h2><span className="text-xs text-muted-foreground">do canal</span></div>}
      {active && <FeedList filter={{ kind: "channel", channelId: c.id }} empty="Nenhuma publicação neste canal ainda." />}
      {!active && status !== "pending" && status !== "banned" && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Entre neste canal para acessar suas publicações e mensagens.</div>}
    </AppShell>
  );
}
