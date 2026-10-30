import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useConversations, useRespondConversation } from "@/lib/social";

export const Route = createFileRoute("/mensagens")({
  head: () => ({
    meta: [
      { title: "Mensagens — SetupSocial" },
      { name: "description", content: "Suas conversas privadas no SetupSocial." },
      { property: "og:title", content: "Mensagens — SetupSocial" },
      { property: "og:description", content: "Conversas privadas no SetupSocial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Messages,
});

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Messages() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isThread = pathname !== "/mensagens" && pathname.startsWith("/mensagens/");
  const { userId, ready } = useAuth();
  const convs = useConversations();
  const respond = useRespondConversation();

  if (isThread) return <Outlet />;

  if (!ready)
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-xl bg-card" />
      </AppShell>
    );
  if (!userId)
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-8 text-center">
          <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            <Link to="/auth" className="text-lavender hover:underline">
              Entre
            </Link>{" "}
            para ver suas conversas.
          </p>
        </div>
      </AppShell>
    );

  const requests = (convs.data ?? []).filter((c) => !c.accepted && c.requester_id !== userId);
  const active = (convs.data ?? []).filter((c) => c.accepted || c.requester_id === userId);

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Mensagens</h1>
      {convs.isLoading && <div className="h-40 animate-pulse rounded-xl bg-card" />}
      {convs.isError && <p className="text-destructive">Erro ao carregar conversas.</p>}

      {requests.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Pedidos de conversa</h2>
          <div className="flex flex-col gap-2">
            {requests.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-warning/40 bg-card p-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-bold text-primary-foreground">
                  {c.other?.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.other?.display_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{c.lastMessage?.body ?? "quer conversar com você"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, accept: true })}>
                    Aceitar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, accept: false })}>
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {active.map((c) => (
          <Link key={c.id} to="/mensagens/$id" params={{ id: c.id }} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-bold text-primary-foreground">
              {c.other?.display_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.other?.display_name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {!c.accepted && c.requester_id === userId ? "Pedido enviado — aguardando aceite" : (c.lastMessage?.body ?? "Comece a conversa")}
              </p>
            </div>
            {c.lastMessage && <span className="text-xs text-muted-foreground">{timeAgo(c.lastMessage.created_at)}</span>}
          </Link>
        ))}
      </div>
      {convs.data?.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center text-muted-foreground">
          Nenhuma conversa ainda. Visite o perfil de alguém e toque em “Mensagem”.
        </div>
      )}
    </AppShell>
  );
}
