import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ProfileAvatar({ path, name, large = false }: { path?: string | null; name: string; large?: boolean }) {
  const photo = useQuery({
    queryKey: ["profile-photo", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from("profile-photos").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand font-display font-bold text-primary-foreground ${large ? "size-20 text-2xl" : "size-12 text-lg"}`}>
      {photo.data ? <img src={photo.data} alt={`Foto de ${name}`} className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
    </div>
  );
}