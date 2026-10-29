import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MACHINE_FIELDS, machineValues } from "@/lib/profile";

export function MachineEditor({ userId, editable }: { userId: string; editable?: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const machine = useQuery({
    queryKey: ["machine", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("machine_specs").eq("id", userId).single();
      if (error) throw error;
      return machineValues(data.machine_specs);
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const specs = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
      const { error } = await supabase.from("profiles").update({ machine_specs: specs }).eq("id", userId).select("id").single();
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["machine", userId] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Máquina atualizada");
    },
    onError: () => toast.error("Não foi possível salvar a máquina"),
  });
  if (machine.isLoading) return <div className="h-16 animate-pulse rounded-lg bg-muted" />;
  if (machine.isError) return <Button variant="outline" onClick={() => machine.refetch()}>Tentar novamente</Button>;
  if (editing) return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {MACHINE_FIELDS.map(([key, label]) => (
        <label key={key} className="grid gap-1 text-xs text-muted-foreground">
          {label}
          <textarea aria-label={label} rows={key === "other" ? 3 : 1} value={values[key] ?? ""} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="min-h-9 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit" disabled={save.isPending}><Save /> Salvar máquina</Button>
        <Button size="sm" variant="ghost" type="button" disabled={save.isPending} onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </form>
  );
  const current = machine.data ?? {};
  return (
    <div className="grid gap-3">
      {Object.keys(current).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma especificação cadastrada ainda.</p>}
      <dl className="grid gap-2">
        {MACHINE_FIELDS.filter(([key]) => current[key]).map(([key, label]) => (
          <div key={key} className="border-b pb-2 last:border-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm">{current[key]}</dd>
          </div>
        ))}
      </dl>
      {editable && <Button variant="outline" size="sm" className="justify-self-start" onClick={() => { setValues(current); setEditing(true); }}><Pencil /> Editar máquina</Button>}
    </div>
  );
}
