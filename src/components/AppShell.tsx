import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Compass, Cpu, Users, Bookmark, MessageSquare, PenSquare, LogIn, LogOut, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { RightPanel } from "@/components/RightPanel";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/equipamentos", label: "Equipamentos", icon: Cpu },
  { to: "/canais", label: "Canais", icon: Users },
  { to: "/mensagens", label: "Mensagens", icon: MessageSquare },
  { to: "/salvos", label: "Salvos", icon: Bookmark },
] as const;

const MOBILE_NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/canais", label: "Canais", icon: Users },
  { to: "/mensagens", label: "Mensagens", icon: MessageSquare },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-primary-foreground">
        <Cpu className="size-4" />
      </span>
      <span>
        Setup<span className="text-lavender">Social</span>
      </span>
    </Link>
  );
}

function LeftColumn() {
  const { userId } = useAuth();
  const { data: me } = useMyProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] flex-col gap-5 lg:flex">
      <Logo />
      <Button asChild className="w-full">
        <Link to="/" hash="publicar">
          <PenSquare /> Criar publicação
        </Link>
      </Button>
      <nav className="flex flex-col gap-1" aria-label="Principal">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto">
        {userId ? (
          <div className="flex items-center gap-2">
            {me && (
              <Link to="/u/$username" params={{ username: me.username }} className="min-w-0 flex-1 truncate text-sm">
                @{me.username}
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut /> Sair
            </Button>
          </div>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth">
              <LogIn /> Entrar
            </Link>
          </Button>
        )}
      </div>
    </aside>
  );
}

function MobileNav() {
  const { userId } = useAuth();
  const { data: me } = useMyProfile();
  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 backdrop-blur lg:hidden"
    >
      {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground data-[status=active]:text-primary"
        >
          <Icon className="size-5" /> {label}
        </Link>
      ))}
      {userId && me ? (
        <Link
          to="/u/$username"
          params={{ username: me.username }}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground data-[status=active]:text-primary"
        >
          <UserRound className="size-5" /> Perfil
        </Link>
      ) : (
        <Link to="/auth" className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground">
          <LogIn className="size-5" /> Entrar
        </Link>
      )}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] px-3 pb-24 pt-4 sm:px-5 lg:pb-8">
      <header className="mb-4 lg:hidden">
        <Logo />
      </header>
      <div className="app-grid">
        <LeftColumn />
        <main className="min-w-0">{children}</main>
        <aside className="hidden md:block">
          <div className="sticky top-4">
            <RightPanel />
          </div>
        </aside>
      </div>
      <MobileNav />
    </div>
  );
}
