export const MACHINE_FIELDS = [
  ["name", "Nome da máquina"],
  ["processor", "Processador"],
  ["motherboard", "Placa-mãe"],
  ["graphics", "Placa de vídeo"],
  ["memory", "Memória RAM"],
  ["storage", "Armazenamento"],
  ["power", "Fonte de alimentação"],
  ["cooling", "Refrigeração"],
  ["case", "Gabinete"],
  ["monitor", "Monitor"],
  ["peripherals", "Periféricos"],
  ["system", "Sistema operacional"],
  ["other", "Outras especificações"],
] as const;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validUsername(value: string) {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

export function machineValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}