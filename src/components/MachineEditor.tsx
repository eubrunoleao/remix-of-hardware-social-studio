
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  EXTRA_MACHINE_CATEGORIES,
  MACHINE_FIELDS,
  extraMachineRows,
  machineValues,
} from "@/lib/profile";

export function MachineEditor({
  userId,
  editable,
}: {
  userId: string;
  editable?: boolean;
}) {
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [categoryToAdd, setCategoryToAdd] = useState("");

  const machine = useQuery({
    queryKey: ["machine", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("machine_specs")
        .eq("id", userId)
        .single();

      if (error) throw error;

      return machineValues(data.machine_specs);
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const cleaned: Record<string, string> = {};

      for (const [key, value] of Object.entries(values)) {
        if (typeof value === "string" && value.trim()) {
          cleaned[key] = value.trim();
        }
      }

      // Não mantém categorias extras sem especificação preenchida.
      for (const row of extraMachineRows(values)) {
        const valueKey = `extra_${row.index}_value`;
        const labelKey = `extra_${row.index}_label`;

        if (!cleaned[valueKey]) {
          delete cleaned[labelKey];
          delete cleaned[valueKey];
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({ machine_specs: cleaned })
        .eq("id", userId)
        .select("id")
        .single();

      if (error) throw error;
    },

    onSuccess: async () => {
      setEditing(false);

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["machine", userId] }),
        qc.invalidateQueries({ queryKey: ["profile"] }),
      ]);

      toast.success("Configuração da máquina salva!");
    },

    onError: () => {
      toast.error("Não foi possível salvar a configuração da máquina.");
    },
  });

  function updateValue(key: string, value: string) {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function addCategory(category: string) {
    if (!category) return;

    const indices = Object.keys(values)
      .map((key) => /^extra_(\d+)_/.exec(key))
      .filter(Boolean)
      .map((match) => Number(match![1]));

    const index = indices.length ? Math.max(...indices) + 1 : 0;

    setValues((previous) => ({
      ...previous,
      [`extra_${index}_label`]: category,
      [`extra_${index}_value`]: "",
    }));

    setCategoryToAdd("");
  }

  function removeCategory(index: number) {
    setValues((previous) => {
      const next = { ...previous };

      delete next[`extra_${index}_label`];
      delete next[`extra_${index}_value`];

      return next;
    });
  }

  if (machine.isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-muted" />;
  }

  if (machine.isError) {
    return (
      <Button variant="outline" onClick={() => machine.refetch()}>
        Tentar novamente
      </Button>
    );
  }

  const current = machine.data ?? {};
  const extraRows = extraMachineRows(editing ? values : current);

  if (editing) {
    return (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Preencha apenas os componentes que quiser. Todos os campos são
          opcionais. Você pode escrever o modelo exato de cada peça.
        </p>

        {MACHINE_FIELDS.map(([key, label]) => (
          <label
            key={key}
            className="grid gap-1 text-sm"
          >
            <span className="text-muted-foreground">{label}</span>

            <textarea
              aria-label={label}
              rows={key === "other" ? 3 : 1}
              maxLength={key === "other" ? 2000 : 200}
              value={values[key] ?? ""}
              onChange={(event) => updateValue(key, event.target.value)}
              placeholder={`Opcional: informe ${label.toLowerCase()}`}
              className="min-h-10 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        ))}

        <div className="grid gap-3 rounded-lg border p-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Plus className="size-4" />
              Adicionar outro componente
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              Escolha uma categoria adicional para detalhar seu setup.
            </p>
          </div>

          <select
            aria-label="Categoria adicional"
            value={categoryToAdd}
            onChange={(event) => addCategory(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Selecione uma categoria...</option>

            {EXTRA_MACHINE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          {extraRows.map((row) => (
            <div
              key={row.index}
              className="grid gap-2 rounded-md border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{row.label}</span>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover ${row.label}`}
                  onClick={() => removeCategory(row.index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <textarea
                aria-label={`Especificação: ${row.label}`}
                rows={2}
                maxLength={1000}
                value={values[`extra_${row.index}_value`] ?? ""}
                onChange={(event) =>
                  updateValue(
                    `extra_${row.index}_value`,
                    event.target.value,
                  )
                }
                placeholder={`Modelo, marca ou detalhes de ${row.label.toLowerCase()}`}
                className="min-h-10 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            <Save className="size-4" />
            {save.isPending ? "Salvando..." : "Salvar máquina"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => {
              setValues(current);
              setCategoryToAdd("");
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-3">
      {Object.keys(current).length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma especificação cadastrada. Você pode adicionar sua máquina
          quando quiser.
        </p>
      )}

      <dl className="grid gap-2">
        {MACHINE_FIELDS.filter(([key]) => current[key]).map(
          ([key, label]) => (
            <div key={key} className="border-b pb-2 last:border-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap break-words text-sm">
                {current[key]}
              </dd>
            </div>
          ),
        )}

        {extraRows
          .filter((row) => row.value.trim())
          .map((row) => (
            <div
              key={row.index}
              className="border-b pb-2 last:border-0"
            >
              <dt className="text-xs text-muted-foreground">
                {row.label}
              </dt>
              <dd className="whitespace-pre-wrap break-words text-sm">
                {row.value}
              </dd>
            </div>
          ))}
      </dl>

      {editable && (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            setValues(current);
            setEditing(true);
          }}
        >
          <Pencil className="size-4" />
          {Object.keys(current).length ? "Editar máquina" : "Cadastrar máquina"}
        </Button>
      )}
    </div>
  );
}
