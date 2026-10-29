
export const MACHINE_FIELDS = [
  ["processor", "Processador"],
  ["motherboard", "Placa-mãe"],
  ["graphics", "Placa de vídeo (GPU)"],
  ["storage", "Armazenamento (SSD / HD)"],
  ["memory", "Memória RAM"],
  ["cooling", "Refrigeração (air cooler / water cooler / low profile)"],
  ["case", "Gabinete"],
  ["power", "Fonte de alimentação"],
  ["fans", "Ventoinhas e kits de fans"],
  ["monitor", "Monitor"],
  ["mouse", "Mouse"],
  ["keyboard", "Teclado"],
  ["mousepad", "Mousepad / deskpad"],
  ["microphone", "Microfone"],
  ["arm", "Braço articulado"],
  ["headset", "Fone de ouvido / headset"],
  ["name", "Nome da máquina"],
  ["system", "Sistema operacional"],
  ["other", "Outras especificações"],
] as const;

export const EXTRA_MACHINE_CATEGORIES = [
  "Monitores e displays",
  "Mouses",
  "Teclados",
  "Mousepads e deskpads",
  "Headsets e fones",
  "Microfones e áudio",
  "Webcams e câmeras",
  "Controles e gamepads",
  "Volantes e simuladores",
  "Placas de vídeo (GPU)",
  "Processadores (CPU)",
  "Placas-mãe",
  "Memórias RAM",
  "Armazenamento interno (SSD e HD)",
  "Armazenamento externo",
  "Fontes de alimentação",
  "Gabinetes",
  "Air coolers",
  "Water coolers",
  "Ventoinhas e kits de fans",
  "Controladoras RGB/ARGB e hubs",
  "Placas de expansão e captura",
  "Redes e conectividade",
  "Cabos e adaptadores",
  "Nobreaks, filtros de linha e energia",
  "Computadores, notebooks e mini PCs",
  "Consoles e realidade virtual",
  "Mesas e cadeiras",
  "Suportes e organização do setup",
  "Iluminação e decoração do setup",
  "Streaming e criação de conteúdo",
  "Ferramentas e manutenção",
  "Acessórios e componentes diversos",
] as const;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validUsername(value: string) {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

export function machineValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string",
    ),
  );
}

export function extraMachineRows(values: Record<string, string>) {
  return Object.keys(values)
    .map((key) => {
      const match = /^extra_(\d+)_label$/.exec(key);

      if (!match) return null;

      const index = Number(match[1]);

      return {
        index,
        label: values[`extra_${index}_label`] ?? "",
        value: values[`extra_${index}_value`] ?? "",
      };
    })
    .filter(
      (
        row,
      ): row is { index: number; label: string; value: string } =>
        row !== null && row.label.length > 0,
    )
    .sort((a, b) => a.index - b.index);
}
