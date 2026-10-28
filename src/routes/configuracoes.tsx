import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Trash2, UserRound, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { removeMyImages } from "@/lib/images";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — SetupSocial" },
      { name: "description", content: "Gerencie seu perfil, exporte ou exclua seus dados no SetupSocial." },
      { property: "og:title", content: "Configurações — SetupSocial" },
      { property: "og:description", content: "Privacidade e dados da sua conta no SetupSocial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { userId, ready } = useAuth();
  const { data: me } = useMyProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function exportData() {
    setBusy(true);
    try {
      const uid = userId!;
      const pick = async (table: string, col: string) => {
        const { data, error } = await (supabase.from(table as any) as any).select("*").eq(col, uid).limit(5000);
        if (error) throw error;
        return data;
      };
      const out = {
        exportado_em: new Date().toISOString(),
        perfil: me,
        publicacoes: await pick("posts", "author_id"),
        comentarios: await pick("comments", "author_id"),
        curtidas: await pick("post_likes", "user_id"),
        salvos: await pick("post_saves", "user_id"),
        equipamentos: await pick("user_devices", "user_id"),
        seguindo: await pick("follows", "follower_id"),
        canais_seguidos: await pick("channel_follows", "user_id"),
        silenciados: await pick("mutes", "user_id"),
        bloqueados: await pick("blocks", "blocker_id"),
        mensagens_enviadas: await pick("messages", "sender_id"),
        denuncias: await pick("reports", "reporter_id"),
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `setupsocial-${me?.username ?? "dados"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Arquivo gerado");
    } catch {
      toast.error("Não foi possível exportar seus dados");
    }
    setBusy(false);
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await removeMyImages(userId!);
    } catch {
      /* imagens órfãs não impedem a exclusão */
    }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      toast.error("Não foi possível excluir a conta");
      return;
    }
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Conta e dados excluídos");
    navigate({ to: "/", replace: true });
  }

  if (!ready) return <AppShell>{null}</AppShell>;
  if (!userId)
    return (
      <AppShell>
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">
          <Link to="/auth" className="text-lavender hover:underline">Entre</Link> para acessar suas configurações.
        </p>
      </AppShell>
    );

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Configurações</h1>
      <div className="flex flex-col gap-4">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><UserRound className="size-4" /> Perfil</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nome de exibição e bio são editados na sua página de perfil.</p>
          {me && (
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/u/$username" params={{ username: me.username }}>Abrir meu perfil</Link>
            </Button>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> Privacidade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas publicações, comentários, perfil e "Minha máquina" são públicos. Curtidas visíveis só como contagem; salvos,
            silenciados, bloqueios e mensagens são privados. Pessoas desconhecidas só podem enviar até 3 mensagens antes de você aceitar.
          </p>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Download className="size-4" /> Exportar meus dados</h2>
          <p className="mt-1 text-sm text-muted-foreground">Baixe um arquivo com tudo o que você publicou e configurou.</p>
          <Button size="sm" className="mt-3" onClick={exportData} disabled={busy}>Baixar arquivo</Button>
        </section>
        <section className="rounded-xl border border-destructive/40 bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-destructive"><Trash2 className="size-4" /> Excluir conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Remove permanentemente sua conta, publicações, imagens, comentários, mensagens e equipamentos. Não pode ser desfeito.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              aria-label="Digite EXCLUIR para confirmar"
              placeholder="Digite EXCLUIR"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
            <Button variant="destructive" size="sm" disabled={busy || confirmText !== "EXCLUIR"} onClick={deleteAccount}>
              Excluir definitivamente
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
