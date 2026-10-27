import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Bookmark, Link2, Star, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToggle, type FeedPost } from "@/lib/posts";
import { Button } from "@/components/ui/button";

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Comments({ postId }: { postId: string }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const q = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, body, created_at, author_id, author:profiles(username, display_name)")
        .eq("post_id", postId)
        .order("created_at")
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("comments").insert({ post_id: postId, author_id: userId!, body: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast.error("Não foi possível comentar"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
      {q.isLoading && <p className="text-xs text-muted-foreground">Carregando comentários…</p>}
      {q.isError && <p className="text-xs text-destructive">Erro ao carregar comentários.</p>}
      {q.data?.length === 0 && <p className="text-xs text-muted-foreground">Seja o primeiro a comentar.</p>}
      {q.data?.map((c: any) => (
        <div key={c.id} className="group rounded-lg bg-secondary px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/u/$username" params={{ username: c.author?.username }} className="font-medium text-foreground hover:text-lavender">
              {c.author?.display_name}
            </Link>
            · {timeAgo(c.created_at)}
            {c.author_id === userId && (
              <button className="ml-auto opacity-60 hover:opacity-100" aria-label="Excluir comentário" onClick={() => del.mutate(c.id)}>
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
        </div>
      ))}
      {userId ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !add.isPending) add.mutate();
          }}
        >
          <input
            aria-label="Escrever comentário"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um comentário…"
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
          />
          <Button size="sm" type="submit" disabled={!text.trim() || add.isPending}>
            Enviar
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          <Link to="/auth" className="text-lavender hover:underline">
            Entre
          </Link>{" "}
          para comentar.
        </p>
      )}
    </div>
  );
}

export function PostCard({ post, liked, saved }: { post: FeedPost; liked: boolean; saved: boolean }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const like = useToggle("post_likes");
  const save = useToggle("post_saves");
  const [open, setOpen] = useState(false);

  const needAuth = () => {
    toast("Entre para interagir", { action: { label: "Entrar", onClick: () => (window.location.href = "/auth") } });
  };

  async function remove() {
    if (!confirm("Excluir esta publicação?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast.error("Não foi possível excluir");
      return;
    }
    toast.success("Publicação excluída");
    qc.invalidateQueries({ queryKey: ["feed"] });
  }

  return (
    <article className="rounded-xl border bg-card p-4">
      <header className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-display font-bold text-primary-foreground">
          {post.author?.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <Link to="/u/$username" params={{ username: post.author?.username ?? "" }} className="font-semibold hover:text-lavender">
              {post.author?.display_name}
            </Link>
            <span className="text-muted-foreground">@{post.author?.username}</span>
            <span className="text-muted-foreground">· {timeAgo(post.created_at)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {post.category && <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{post.category.name}</span>}
            {post.channel && (
              <Link to="/canais/$slug" params={{ slug: post.channel.slug }} className="rounded bg-accent/15 px-2 py-0.5 text-lavender hover:underline">
                {post.channel.name}
              </Link>
            )}
            {post.is_review && (
              <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-warning">
                Avaliação <Star className="size-3 fill-warning" /> {post.rating}/5
              </span>
            )}
          </div>
        </div>
        {post.author_id === userId && (
          <button onClick={remove} aria-label="Excluir publicação" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>

      {(post.products.length > 0 || post.tags.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {post.products.map((p) => (
            <Link key={p.slug} to="/equipamentos/$slug" params={{ slug: p.slug }} className="rounded-full bg-primary/15 px-2.5 py-1 text-primary hover:bg-primary/25">
              {p.name}
            </Link>
          ))}
          {post.tags.map((t) => (
            <Link key={t.tag} to="/tag/$tag" params={{ tag: t.tag }} className="rounded-full px-1.5 py-1 text-lavender hover:underline">
              #{t.label || t.tag}
            </Link>
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={liked}
          onClick={() => (userId ? like.mutate({ postId: post.id, on: !liked }) : needAuth())}
          className={liked ? "text-destructive" : ""}
        >
          <Heart className={liked ? "fill-destructive" : ""} /> {post.likeCount}
        </Button>
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          <MessageCircle /> {post.commentCount}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={saved}
          aria-label={saved ? "Remover dos salvos" : "Salvar"}
          onClick={() => (userId ? save.mutate({ postId: post.id, on: !saved }) : needAuth())}
          className={saved ? "text-primary" : ""}
        >
          <Bookmark className={saved ? "fill-primary" : ""} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Copiar link"
          onClick={async () => {
            await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
            toast.success("Link copiado");
          }}
        >
          <Link2 />
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto" aria-label="Denunciar (em breve)" disabled title="Denúncias chegam em breve">
          <Flag />
        </Button>
      </footer>
      {open && <Comments postId={post.id} />}
    </article>
  );
}
