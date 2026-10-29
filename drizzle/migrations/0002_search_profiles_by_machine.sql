
CREATE OR REPLACE FUNCTION public.search_profiles_by_machine(search_term text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  matched_components text[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH term AS (
    SELECT trim(search_term) AS value
  ),
  entries AS (
    SELECT
      p.id AS profile_id,
      p.username,
      p.display_name,
      p.avatar_path,
      item.key,
      item.value,
      CASE
        WHEN item.key = 'processor' THEN 'Processador'
        WHEN item.key = 'motherboard' THEN 'Placa-mãe'
        WHEN item.key = 'graphics' THEN 'Placa de vídeo (GPU)'
        WHEN item.key = 'storage' THEN 'Armazenamento (SSD / HD)'
        WHEN item.key = 'memory' THEN 'Memória RAM'
        WHEN item.key = 'cooling' THEN 'Refrigeração'
        WHEN item.key = 'case' THEN 'Gabinete'
        WHEN item.key = 'power' THEN 'Fonte de alimentação'
        WHEN item.key = 'fans' THEN 'Ventoinhas e kits de fans'
        WHEN item.key = 'monitor' THEN 'Monitor'
        WHEN item.key = 'mouse' THEN 'Mouse'
        WHEN item.key = 'keyboard' THEN 'Teclado'
        WHEN item.key = 'mousepad' THEN 'Mousepad / deskpad'
        WHEN item.key = 'microphone' THEN 'Microfone'
        WHEN item.key = 'arm' THEN 'Braço articulado'
        WHEN item.key = 'headset' THEN 'Fone de ouvido / headset'
        WHEN item.key = 'name' THEN 'Nome da máquina'
        WHEN item.key = 'system' THEN 'Sistema operacional'
        WHEN item.key = 'other' THEN 'Outras especificações'
        WHEN item.key ~ '^extra_[0-9]+_value$'
          THEN COALESCE(
            p.machine_specs ->> regexp_replace(item.key, '_value$', '_label'),
            'Componente adicional'
          )
        ELSE item.key
      END AS component_label
    FROM public.profiles p
    CROSS JOIN LATERAL jsonb_each_text(
      COALESCE(p.machine_specs, '{}'::jsonb)
    ) AS item(key, value)
    WHERE item.key !~ '^extra_[0-9]+_label$'
  ),
  matches AS (
    SELECT e.*
    FROM entries e
    CROSS JOIN term t
    WHERE char_length(t.value) >= 2
      AND (
        e.value ILIKE '%' || t.value || '%'
        OR e.component_label ILIKE '%' || t.value || '%'
      )
  )
  SELECT
    m.profile_id,
    m.username,
    m.display_name,
    m.avatar_path,
    array_agg(DISTINCT m.component_label ORDER BY m.component_label)
  FROM matches m
  GROUP BY
    m.profile_id,
    m.username,
    m.display_name,
    m.avatar_path
  ORDER BY
    cardinality(array_agg(DISTINCT m.component_label)) DESC,
    m.display_name ASC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.search_profiles_by_machine(text)
TO anon, authenticated;
