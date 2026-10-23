-- Hero için dikey mobil vinç fotoğrafını varsayılan yap.
UPDATE site_settings
SET value_json = json_set(value_json, '$.hero_image', '/assets/yukvinc-hero.webp'),
    updated_at = unixepoch()
WHERE setting_key = 'public_site'
  AND json_extract(value_json, '$.hero_image') = '/assets/hero.svg';
