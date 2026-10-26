// Mirrors public.normalize_hashtag in the database so the UI previews the same tag the server stores.
export const MAX_HASHTAGS = 8;

export function normalizeHashtag(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function isValidHashtag(tag: string): boolean {
  return tag.length >= 2 && tag.length <= 30;
}

export function parseHashtags(input: string): string[] {
  const out: string[] = [];
  for (const piece of input.split(/[\s,#]+/)) {
    const n = normalizeHashtag(piece);
    if (isValidHashtag(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

const SUGGESTIONS: Record<string, string[]> = {
  gpu: ["GPU", "Desempenho", "Temperatura"],
  cpu: ["CPU", "Desempenho"],
  "placa-mae": ["PlacaMae", "Compatibilidade"],
  memoria: ["RAM", "Compatibilidade"],
  armazenamento: ["SSD", "Velocidade"],
  fonte: ["Fonte", "Durabilidade"],
  refrigeracao: ["WaterCooler", "AirCooler", "Temperatura"],
  monitor: ["Monitor", "CustoBeneficio"],
  mouse: ["Mouse", "Sensor", "Precisao"],
  teclado: ["Teclado", "Durabilidade"],
  headset: ["Headset", "Audio"],
  console: ["Console", "PS5", "XboxSeriesX"],
  celular: ["Android", "iPhone", "Bateria"],
  rede: ["WiFi", "Roteador"],
};

export function suggestHashtags(categorySlug: string | null, isReview: boolean): string[] {
  const base = categorySlug ? (SUGGESTIONS[categorySlug] ?? []) : [];
  return isReview ? [...base, "Review", "CustoBeneficio"] : base;
}
