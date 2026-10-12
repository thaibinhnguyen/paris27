# Paris 27

Personal HYROX Paris 2027 training log. A static PWA (GitHub Pages) backed by Supabase.

- `index.html`: the app (FR/EN)
- `db.js`: Supabase data layer with an offline write queue
- `config.js`: Supabase URL and anon key (public; access is limited by row-level security)
- `sw.js`, `manifest.webmanifest`, `icons/`: installable, full-screen, offline shell
- `supabase/schema.sql`: table and policies
- `vendor/supabase.js`: supabase-js 2.45.4 (MIT)

Setup notes (Vietnamese): `HUONG-DAN.md`.
