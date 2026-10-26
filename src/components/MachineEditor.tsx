import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCatalog } from "@/lib/posts";
import { Button } from "@/components/ui/button";

export function MachineEditor({ userId, editable }: { userId: string; editable?: boolean }) {
  const qc = useQueryClient();
  const catalog = useCatalog();
  const [pick, setPick] = useState("");
  const devices = useQuery({
    queryKey: ["devices", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_devices")
        .select("id, product:products(id, slug, name, category:categories(name))")
        .eq("user_id", userId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("user_devices").insert({ user_id: userId, product_id: productId });
      if (error) throw new Error(error.code === "23505" ? "Esse equipamento já está na sua máquina" : error.message);
    },
    onSuccess: () => {
      setPick("");
      qc.invalidateQueries({ queryKey: ["devices", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_devices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices", userId] }),
    onError: () => toast.error("Não foi possível remover"),
  });

  if (devices.isLoading) return <div className="h-16 animate-pulse rounded-lg bg-muted" />;
  if (devices.isError)
    return (
      <p className="text-sm text-destructive">
        Erro ao carregar.{" "}
        <button className="underline" onClick={() => devices.refetch()}>
          Tentar novamente
        </button>
      </p>
    );

  const owned = new Set(devices.data?.map((d: any) => d.product?.id));
  return (
    <div className="flex flex-col gap-2">
      {devices.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado ainda.</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {devices.data?.map((d: any) => (
          <li key={d.id} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <Link to="/equipamentos/$slug" params={{ slug: d.product.slug }} className="block truncate hover:text-lavender">
                {d.product.name}
              </Link>
              <span className="text-xs text-muted-foreground">{d.product.category?.name}</span>
            </div>
            {editable && (
              <button
                aria-label={`Remover ${d.product.name}`}
                onClick={() => remove.mutate(d.id)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="mt-1 flex gap-2">
          <select
            aria-label="Adicionar equipamento"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Adicionar equipamento…</option>
            {catalog.data?.categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {catalog.data.products
                  .filter((p) => p.category_id === c.id && !owned.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <Button size="icon" aria-label="Adicionar" disabled={!pick || add.isPending} onClick={() => add.mutate(pick)}>
            <Plus />
          </Button>
        </div>
      )}
    </div>
  );
}
