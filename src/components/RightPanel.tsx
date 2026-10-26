import { Link } from "@tanstack/react-router";
import { useAuth, useMyProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { MachineEditor } from "@/components/MachineEditor";

export function RightPanel() {
  const { userId, ready } = useAuth();
  const { data: me } = useMyProfile();

  if (!ready) return <div className="h-48 animate-pulse rounded-xl bg-card" />;

  if (!userId) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Mostre seu setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie uma conta para cadastrar sua máquina e ajudar quem está pesquisando uma compra.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link to="/auth">Entrar ou criar conta</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {me && (
        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-brand font-display text-lg font-bold text-primary-foreground">
              {me.display_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{me.display_name}</p>
              <Link to="/u/$username" params={{ username: me.username }} className="text-sm text-muted-foreground hover:text-lavender">
                @{me.username}
              </Link>
            </div>
          </div>
          {me.bio && <p className="mt-3 text-sm text-muted-foreground">{me.bio}</p>}
        </section>
      )}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Minha máquina</h2>
        <p className="mb-3 text-xs text-muted-foreground">Equipamentos que você possui e pode avaliar.</p>
        <MachineEditor userId={userId} editable />
      </section>
    </div>
  );
}
