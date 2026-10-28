import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const IMAGE_BUCKET = "post-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_POST = 4;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** Retorna mensagem de erro ou null se a imagem é aceita. */
export function validateImage(file: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Formato não suportado (use JPG, PNG, WEBP ou GIF)";
  if (file.size > MAX_IMAGE_BYTES) return "Imagem maior que 5 MB";
  return null;
}

export async function uploadPostImages(userId: string, postId: string, files: File[]) {
  for (const file of files) {
    const path = `${userId}/${postId}/${crypto.randomUUID()}.${EXT[file.type]}`;
    const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    const { error } = await supabase.from("post_images").insert({ post_id: postId, path });
    if (error) throw error;
  }
}

export function useSignedUrls(paths: string[]) {
  return useQuery({
    queryKey: ["signed", paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      return data.map((d) => d.signedUrl).filter(Boolean) as string[];
    },
  });
}

export async function removeMyImages(userId: string) {
  const { data: folders } = await supabase.storage.from(IMAGE_BUCKET).list(userId, { limit: 1000 });
  for (const f of folders ?? []) {
    const { data: files } = await supabase.storage.from(IMAGE_BUCKET).list(`${userId}/${f.name}`, { limit: 100 });
    const paths = (files ?? []).map((x) => `${userId}/${f.name}/${x.name}`);
    if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  }
}
