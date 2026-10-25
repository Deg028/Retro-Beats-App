-- Retro Beats: base de datos local (expo-sqlite). Migración 1.
-- Una sola persona por dispositivo: no hay servidor, ni usuarios, ni RLS.
-- La autorización es el permiso de Android (READ_MEDIA_AUDIO / carpetas elegidas).
-- Ids: las tablas que reflejan MediaStore usan su _ID (INTEGER) en lugar de uuid,
-- para que un nuevo escaneo actualice filas en vez de duplicarlas.
-- Tiempos: INTEGER en milisegundos desde epoch, UTC.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Carpetas que la persona eligió además de la biblioteca del sistema (tarjeta SD, descargas, etc.)
create table folders (
  id integer primary key autoincrement,
  tree_uri text not null unique,          -- content:// con permiso persistente (SAF)
  label text not null,
  include integer not null default 1 check (include in (0, 1)),
  created_at integer not null,
  updated_at integer not null
);

create table albums (
  id integer primary key,                 -- MediaStore ALBUM_ID
  album_key text not null unique,         -- lower(album) || '|' || lower(album_artist): estable entre reindexados
  title text not null,
  album_artist text,
  year integer,
  art_source text not null default 'none'
    check (art_source in ('embedded', 'folder', 'user', 'online', 'none')),
  art_path text,                          -- archivo en caché de la app
  created_at integer not null,
  updated_at integer not null
);

create table tracks (
  id integer primary key,                 -- MediaStore _ID
  content_uri text not null unique,
  volume text not null,                   -- external_primary, o el id de la tarjeta SD
  relative_path text,
  display_name text not null,
  title text not null,
  artist text,
  album_id integer references albums(id) on delete set null,
  track_no integer,
  disc_no integer not null default 1,
  year integer,
  duration_ms integer not null check (duration_ms >= 0),
  mime text,
  size_bytes integer,
  date_modified integer not null,
  replaygain_track_db real,
  replaygain_album_db real,
  available integer not null default 1 check (available in (0, 1)),
  last_seen_scan integer,                 -- scan_runs.id del último escaneo que lo vio
  created_at integer not null,
  updated_at integer not null
);
create index tracks_album on tracks (album_id, disc_no, track_no);
create index tracks_artist on tracks (artist collate nocase);
create index tracks_title on tracks (title collate nocase);
create index tracks_path on tracks (relative_path);
create index tracks_seen on tracks (last_seen_scan);

-- Carátula elegida a mano: sobrevive a reescaneos porque va por album_key, no por id
create table artwork_overrides (
  album_key text primary key,
  source text not null check (source in ('user', 'online', 'folder')),
  local_path text not null,
  created_at integer not null,
  updated_at integer not null
);

create table lyrics (
  track_id integer primary key references tracks(id) on delete cascade,
  source text not null check (source in ('embedded', 'lrc_file', 'user', 'online')),
  synced integer not null default 0 check (synced in (0, 1)),
  body text not null,
  created_at integer not null,
  updated_at integer not null
);

create table play_stats (
  track_id integer primary key references tracks(id) on delete cascade,
  plays integer not null default 0 check (plays >= 0),
  favorite integer not null default 0 check (favorite in (0, 1)),
  last_played_at integer,
  updated_at integer not null
);
create index play_stats_recent on play_stats (last_played_at);
create index play_stats_plays on play_stats (plays);

create table playlists (
  id integer primary key autoincrement,
  name text not null,
  created_at integer not null,
  updated_at integer not null
);

-- Borrar un archivo borra sus filas aquí (arreglo #2: nada de canciones fantasma en las listas)
create table playlist_items (
  playlist_id integer not null references playlists(id) on delete cascade,
  position integer not null,
  track_id integer not null references tracks(id) on delete cascade,
  added_at integer not null,
  primary key (playlist_id, position)
);
create index playlist_items_track on playlist_items (track_id);
create unique index playlist_items_no_dupes on playlist_items (playlist_id, track_id);

-- Cola y posición para retomar exactamente donde quedó (arreglo #7)
create table queue_items (
  position integer primary key,
  track_id integer not null references tracks(id) on delete cascade
);
create index queue_items_track on queue_items (track_id);

create table playback_state (
  id integer primary key check (id = 1),  -- una sola fila
  current_position integer,               -- queue_items.position
  position_ms integer not null default 0,
  shuffle integer not null default 0 check (shuffle in (0, 1)),
  repeat text not null default 'all' check (repeat in ('off', 'all', 'one')),
  updated_at integer not null
);

-- Escaneo transparente (arreglo #3)
create table scan_runs (
  id integer primary key autoincrement,
  started_at integer not null,
  finished_at integer,
  found integer not null default 0,
  added integer not null default 0,
  updated integer not null default 0,
  removed integer not null default 0,
  skipped integer not null default 0,
  status text not null default 'running' check (status in ('running', 'done', 'failed'))
);

create table scan_issues (
  id integer primary key autoincrement,
  scan_id integer not null references scan_runs(id) on delete cascade,
  uri text not null,
  display_name text,
  reason text not null check (reason in
    ('unsupported_format', 'unreadable', 'corrupt', 'too_short', 'excluded_folder', 'no_permission', 'duplicate')),
  detail text
);
create index scan_issues_scan on scan_issues (scan_id);

-- Ajustes: diseño (columnas, lista o cuadrícula), orden, sonido, normalización, etc. (arreglos #4 y #5)
create table settings (
  key text primary key,
  value text not null,                    -- JSON
  updated_at integer not null
);

-- Caché local de la compra; la fuente de verdad es Google Play (arreglo #6)
create table entitlements (
  product_id text primary key,
  purchase_token text not null,
  acknowledged integer not null default 0 check (acknowledged in (0, 1)),
  verified_at integer not null
);

PRAGMA user_version = 1;
