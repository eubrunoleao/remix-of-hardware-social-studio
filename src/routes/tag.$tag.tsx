import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tag/$tag")({
  head: ({ params }) => ({
    meta: [
      { title: `#${params.tag} — SetupSocial` },
      { name: "description", content: `Publicações com a hashtag #${params.tag} no SetupSocial.` },
      { property: "og:title", content: `#${params.tag} — SetupSocial` },
      { property: "og:description", content: `Experiências sobre #${params.tag}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TagPage,
});

function TagPage() {
  const { tag } = Route.useParams();
  const count = useQuery({
    queryKey: ["tagcount", tag],
    queryFn: async () => {
      const { data: h } = await supabase.from("hashtags").select("id, label").eq("tag", tag).maybeSingle();
      if (!h) return { label: tag, count: 0 };
      const { count } = await supabase.from("post_hashtags").select("*", { count: "exact", head: true }).eq("hashtag_id", h.id);
      return { label: h.label || tag, count: count ?? 0 };
    },
  });
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-lavender">#{count.data?.label ?? tag}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{count.data ? `${count.data.count} publicações` : " "}</p>
      <FeedList filter={{ kind: "tag", tag }} empty="Nenhuma publicação com essa hashtag ainda." />
    </AppShell>
  );
}
