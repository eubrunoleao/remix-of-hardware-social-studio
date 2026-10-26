import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCatalog } from "@/lib/posts";
import { MAX_HASHTAGS, normalizeHashtag, parseHashtags, suggestHashtags } from "@/lib/hashtags";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MAX = 2000;

export function PostComposer() {
  const { userId, ready } = useAuth();
  const qc = useQueryClient();
  const catalog = useCatalog();
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isReview, setIsReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const clientKey = useRef(crypto.randomUUID());

  const category = catalog.data?.categories.find((c) => c.id === categoryId);
  const suggestions = useMemo(
    () => suggestHashtags(category?.slug ?? null, isReview).filter((s) => !tags.includes(normalizeHashtag(s))),
    [category, isReview, tags],
  );
  const products = catalog.data?.products.filter((p) => !categoryId || p.category_id === categoryId) ?? [];

  if (!ready) return null;
  if (!userId)
    return (
      <div id="publicar" className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        <Link to="/auth" className="font-medium text-lavender hover:underline">
          Entre
        </Link>{" "}
        para publicar suas experiências com hardware.
      </div>
    );

  function addTags(raw: string) {
    const next = [...tags];
    for (const t of parseHashtags(raw)) if (!next.includes(t) && next.length < MAX_HASHTAGS) next.push(t);
    if (parseHashtags(raw).length + tags.length > MAX_HASHTAGS) toast.warning(`Máximo de ${MAX_HASHTAGS} hashtags`);
    setTags(next);
    setTagInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!body.trim()) return toast.error("Escreva algo antes de publicar");
    if (isReview && !rating) return toast.error("Dê uma nota de 1 a 5 para a avaliação");
    setBusy(true);
    const pending = tagInput.trim() ? [...tags, ...parseHashtags(tagInput)].slice(0, MAX_HASHTAGS) : tags;
    const { error } = await supabase.rpc("create_post", {
      _body: body,
      _category_id: categoryId || (null as unknown as string),
      _product_ids: productIds,
      _tags: pending,
      _is_review: isReview,
      _rating: isReview ? rating : (null as unknown as number),
      _client_key: clientKey.current,
    });
    setBusy(false);
    if (error) return toast.error(error.message || "Não foi possível publicar. Tente novamente.");
    toast.success("Publicado!");
    clientKey.current = crypto.randomUUID();
    setBody("");
    setProductIds([]);
    setTags([]);
    setTagInput("");
    setIsReview(false);
    setRating(0);
    qc.invalidateQueries({ queryKey: ["feed"] });
  }

  return (
    <form id="publicar" onSubmit={submit} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-soft">
      <Textarea
        aria-label="Texto da publicação"
        placeholder="Como está seu equipamento? Conte sobre desempenho, durabilidade, compatibilidade…"
        value={body}
        maxLength={MAX}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-24 resize-y border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          aria-label="Categoria"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setProductIds([]);
          }}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Categoria (opcional)</option>
          {catalog.data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Vincular equipamento"
          value=""
          disabled={productIds.length >= 5}
          onChange={(e) => e.target.value && setProductIds([...productIds, e.target.value])}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">{productIds.length >= 5 ? "Limite de 5 equipamentos" : "Vincular equipamento…"}</option>
          {products
            .filter((p) => !productIds.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>

      {productIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {productIds.map((id) => {
            const p = catalog.data?.products.find((x) => x.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary">
                {p?.name}
                <button type="button" aria-label="Remover equipamento" onClick={() => setProductIds(productIds.filter((x) => x !== id))}>
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs text-lavender">
            #{t}
            <button type="button" aria-label={`Remover #${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          aria-label="Hashtags"
          value={tagInput}
          placeholder={tags.length >= MAX_HASHTAGS ? "Limite atingido" : "#hashtag + Enter"}
          disabled={tags.length >= MAX_HASHTAGS}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTags(tagInput);
            }
          }}
          className="h-7 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {suggestions.length > 0 && tags.length < MAX_HASHTAGS && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-muted-foreground">Sugestões:</span>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => addTags(s)} className="rounded-full border px-2 py-0.5 hover:border-accent hover:text-lavender">
              #{s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isReview} onChange={(e) => setIsReview(e.target.checked)} className="accent-primary" />
            Avaliação de produto
          </label>
          {isReview && (
            <div className="flex" role="radiogroup" aria-label="Nota">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} estrelas`} onClick={() => setRating(n)}>
                  <Star className={`size-5 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {body.length}/{MAX}
          </span>
          <Button type="submit" disabled={busy || !body.trim()}>
            {busy ? "Publicando…" : "Publicar"}
          </Button>
        </div>
      </div>
    </form>
  );
}
