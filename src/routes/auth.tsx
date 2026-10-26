import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — SetupSocial" },
      { name: "description", content: "Entre ou crie sua conta no SetupSocial." },
      { property: "og:title", content: "Entrar — SetupSocial" },
      { property: "og:description", content: "Acesse a rede social do hardware." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (userId) navigate({ to: "/" });
  }, [userId, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { username, display_name: username } },
      });
      if (error) toast.error(error.message);
      else setSent(true);
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com Google");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-soft">
        <Logo />
        {sent ? (
          <p className="mt-6 text-sm">Enviamos um link de confirmação para <b>{email}</b>. Confirme para entrar.</p>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
            <Button variant="outline" className="mt-4 w-full" onClick={google}>Continuar com Google</Button>
            <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
            <form onSubmit={submit} className="flex flex-col gap-3">
              {mode === "up" && (
                <input aria-label="Nome de usuário" required pattern="[a-zA-Z0-9_]{3,24}" title="3 a 24 letras, números ou _" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="nome_de_usuario" className="h-10 rounded-md border bg-background px-3 text-sm" />
              )}
              <input aria-label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="h-10 rounded-md border bg-background px-3 text-sm" />
              <input aria-label="Senha" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="h-10 rounded-md border bg-background px-3 text-sm" />
              <Button type="submit" disabled={busy}>{busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}</Button>
            </form>
            <button className="mt-4 w-full text-center text-sm text-lavender hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
