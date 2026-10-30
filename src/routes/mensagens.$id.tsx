import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Ban } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useConversation, useMessages, useRespondConversation, useSendMessage, useToggleMuteBlock } from "@/lib/social";

export const Route = createFileRoute("/mensagens/$id")({
  head: () => ({
    meta: [
      { title: "Conversa — SetupSocial" },
      { name: "description", content: "Conversa privada no SetupSocial." },
      { property: "og:title", content: "Conversa — SetupSocial" },
      { property: "og:description", content: "Conversa privada no SetupSocial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Thread,
});

function Thread() {
  const { id } = Route.useParams();
  const { userId, ready } = useAuth();
  const navigate = useNavigate();
  const conv = useConversation(id);
  const msgs = useMessages(id);
  const send = useSendMessage(id);
  const respond = useRespondConversation();
  const block = useToggleMuteBlock("blocks");
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.data?.length]);

  if (!ready || conv.isLoading)
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-xl bg-card" />
      </AppShell>
    );
  if (!userId)
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          <Link to="/auth" className="text-lavender hover:underline">
            Entre
          </Link>{" "}
          para ver esta conversa.
        </div>
      </AppShell>
    );
  if (!conv.data)
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-6 text-center">
          Conversa não encontrada.{" "}
          <Link to="/mensagens" className="text-lavender hover:underline">
            Voltar
          </Link>
        </div>
      </AppShell>
    );

  const c = conv.data;
  const isRequester = c.requester_id === userId;
  const pendingForMe = !c.accepted && !isRequester;

  return (
    <AppShell>
      <div className="flex min-h-[60vh] flex-col rounded-xl border bg-card">
        <header className="flex items-center gap-3 border-b p-4">
          <Button variant="ghost" size="sm" aria-label="Voltar" onClick={() => navigate({ to: "/mensagens" })}>
            <ArrowLeft />
          </Button>
          {c.other && (
            <Link to="/u/$username" params={{ username: c.other.username }} className="flex min-w-0 items-center gap-2 hover:text-lavender">
              <span className="grid size-9 place-items-center rounded-full bg-brand font-bold text-primary-foreground">
                {c.other.display_name.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate font-semibold">{c.other.display_name}</span>
            </Link>
          )}
          {c.other && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground"
              aria-label="Bloquear usuário"
              onClick={() => {
                if (confirm(`Bloquear ${c.other!.display_name}? Vocês não poderão trocar mensagens.`)) {
                  block.mutate(
                    { otherId: c.other!.id, on: true },
                    { onSuccess: () => { toast.success("Usuário bloqueado"); navigate({ to: "/mensagens" }); } },
                  );
                }
              }}
            >
              <Ban />
            </Button>
          )}
        </header>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {msgs.data?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga olá!</p>}
          {msgs.data?.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                m.sender_id === userId ? "self-end bg-primary text-primary-foreground" : "self-start bg-secondary"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {pendingForMe ? (
          <div className="flex items-center justify-between gap-3 border-t p-4">
            <p className="text-sm text-muted-foreground">{c.other?.display_name} quer conversar com você.</p>
            <div className="flex gap-2">
              <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, accept: true })}>
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: c.id, accept: false }, { onSuccess: () => navigate({ to: "/mensagens" }) })}
              >
                Recusar
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex gap-2 border-t p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim() || send.isPending) return;
              send.mutate(text.trim(), {
                onSuccess: () => setText(""),
                onError: (err) => toast.error(err.message.includes("limit") ? "Limite de mensagens do pedido atingido — aguarde o aceite" : `Falha ao enviar: ${err.message}`),
              });
            }}
          >
            <input
              aria-label="Escrever mensagem"
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              placeholder={!c.accepted && isRequester ? "Mensagem do pedido (máx. 3)…" : "Escreva uma mensagem…"}
              className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
            />
            <Button type="submit" disabled={!text.trim() || send.isPending}>
              Enviar
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
