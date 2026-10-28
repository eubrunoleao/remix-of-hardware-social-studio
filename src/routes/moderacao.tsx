import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyRoles } from "@/lib/roles";

export const Route = createFileRoute("/moderacao")({
  head: () => ({
    meta: [
      { title: "Moderação — SetupSocial" },
      { name: "description", content: "Painel de moderação: denúncias, papéis e auditoria." },
      { property: "og:title", content: "Moderação — SetupSocial" },
      { property: "og:description", content: "Painel de moderação do SetupSocial." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Moderation,
});

const REASON: Record<string, string> = { spam: "Spam", ofensivo: "Ofensivo", enganoso: "Enganoso", outro: "Outro" };

function Moderation() {
  const { userId, ready } = useAuth();
  const roles = useMyRoles();
  const qc = useQueryClient();
  const isStaff = (roles.data?.length ?? 0) > 0;
  const isAdmin = roles.data?.includes("admin") ?? false;

  const claim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_first_admin");
      if (error) throw error;
      return data;
    },
    onSuccess: (ok) => {
      toast[ok ? "success" : "error"](ok ? "Você agora é administrador" : "Já existe um administrador");
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  if (!ready || roles.isLoading) return <AppShell><div className="h-40 animate-pulse rounded-xl bg-card" /></AppShell>;
  if (!userId)
    return (
      <AppShell>
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">
          <Link to="/auth" className="text-lavender hover:underline">Entre</Link> para acessar.
        </p>
      </AppShell>
    );
  if (!isStaff)
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-6">
          <h1 className="text-xl font-bold">Moderação</h1>
          <p className="mt-2 text-sm text-muted-foreground">Esta área é restrita a administradores e moderadores.</p>
          <p className="mt-2 text-sm text-muted-foreground">Se ainda não há nenhum administrador, a primeira pessoa pode assumir o papel.</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => claim.mutate()} disabled={claim.isPending}>
            Tornar-me o primeiro administrador
          </Button>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Moderação</h1>
      <div className="flex flex-col gap-4">
        <Reports />
        {isAdmin && <RolesAdmin />}
        <AuditLog />
      </div>
    </AppShell>
  );
}

function Reports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("aberta");
  const q = useQuery({
    queryKey: ["reports", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, reason, details, status, created_at, post_id, post:posts(body, author:profiles!posts_author_id_fkey(username))")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });
  const act = useMutation({
    mutationFn: async ({ id, remove }: { id: string; remove: boolean }) => {
      const { error } = await supabase.rpc("resolve_report", { _report_id: id, _remove_post: remove, _note: "" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Denúncia tratada");
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast.error("Não foi possível concluir"),
  });

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Denúncias</h2>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
          <option value="aberta">Abertas</option>
          <option value="resolvida">Resolvidas</option>
          <option value="rejeitada">Rejeitadas</option>
        </select>
      </div>
      {q.isError && <p className="mt-3 text-sm text-destructive">Erro ao carregar.</p>}
      {q.data?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhuma denúncia aqui.</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {q.data?.map((r) => (
          <li key={r.id} className="rounded-lg bg-secondary p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-warning/15 px-2 py-0.5 text-warning">{REASON[r.reason]}</span>
              {new Date(r.created_at).toLocaleString("pt-BR")}
              {r.post?.author && <>· de @{r.post.author.username}</>}
            </div>
            {r.post ? (
              <Link to="/post/$id" params={{ id: r.post_id }} className="mt-1 line-clamp-3 block hover:text-lavender">{r.post.body}</Link>
            ) : (
              <p className="mt-1 italic text-muted-foreground">Publicação removida</p>
            )}
            {r.details && <p className="mt-1 text-xs text-muted-foreground">“{r.details}”</p>}
            {status === "aberta" && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="destructive" disabled={act.isPending} onClick={() => confirm("Remover a publicação?") && act.mutate({ id: r.id, remove: true })}>
                  Remover publicação
                </Button>
                <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, remove: false })}>
                  Rejeitar denúncia
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RolesAdmin() {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"moderator" | "admin">("moderator");
  const run = async (grant: boolean) => {
    const { error } = await supabase.rpc("set_user_role", { _username: username.replace(/^@/, "").trim(), _role: role, _grant: grant });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(grant ? "Papel concedido" : "Papel removido");
    setUsername("");
    qc.invalidateQueries({ queryKey: ["audit"] });
  };
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Papéis da equipe</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <input aria-label="Usuário" placeholder="@usuario" value={username} onChange={(e) => setUsername(e.target.value)} className="h-9 flex-1 rounded-md border bg-background px-3 text-sm" />
        <select aria-label="Papel" value={role} onChange={(e) => setRole(e.target.value as any)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="moderator">Moderador</option>
          <option value="admin">Administrador</option>
        </select>
        <Button size="sm" disabled={!username.trim()} onClick={() => run(true)}>Conceder</Button>
        <Button size="sm" variant="outline" disabled={!username.trim()} onClick={() => run(false)}>Remover</Button>
      </div>
    </section>
  );
}

function AuditLog() {
  const q = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("moderation_log").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Auditoria</h2>
      {q.data?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhuma ação registrada.</p>}
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {q.data?.map((l) => (
          <li key={l.id} className="flex flex-wrap gap-2 border-b py-1.5 last:border-0">
            <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
            <span className="font-medium">{l.action.replace(/_/g, " ")}</span>
            {l.note && <span className="text-muted-foreground">({l.note})</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
