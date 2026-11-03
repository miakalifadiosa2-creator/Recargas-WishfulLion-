-- ============================================================
--  Esquema PostgreSQL · WishfulLion6770 (se aplica en cada arranque)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin (                    -- UNA sola fila: el único administrador
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL                         -- bcrypt, nunca texto plano
);
CREATE TABLE IF NOT EXISTS games (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,                 -- URL pública: #/juego/<slug>
  name          TEXT NOT NULL UNIQUE,
  cover_data    BYTEA,                                -- portada guardada en la base de datos
  cover_type    TEXT,                                 -- image/png, image/jpeg o image/webp
  id_label      TEXT NOT NULL DEFAULT 'Player ID',    -- cómo se llama el campo de ID en ese juego
  extra_field   TEXT,                                 -- campo adicional (ej. 'Zone ID'); NULL si no aplica
  currency_name TEXT NOT NULL DEFAULT 'Diamantes',    -- Diamantes, Bonds, Golds...
  tag           TEXT,
  active        SMALLINT NOT NULL DEFAULT 1           -- 0 = oculto en la web
);
CREATE TABLE IF NOT EXISTS packages (
  id       SERIAL PRIMARY KEY,
  game_id  INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  label    TEXT NOT NULL,                             -- '100 + 10', 'Tarjeta Semanal'...
  image    TEXT,                                      -- opcional (si es NULL se muestra un ícono)
  price_bs DOUBLE PRECISION NOT NULL CHECK (price_bs > 0),
  active   SMALLINT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,                    -- código público del pedido (WL-XXXXXX)
  game_id    INTEGER NOT NULL REFERENCES games(id),
  package_id INTEGER NOT NULL REFERENCES packages(id),
  player_id  TEXT NOT NULL,
  zone       TEXT,
  nickname   TEXT,
  price_bs   DOUBLE PRECISION NOT NULL,               -- precio congelado al momento de comprar
  proof      BYTEA NOT NULL,                          -- foto del comprobante (privada: solo la ve el admin)
  proof_type TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'completado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, id);

-- Migraciones (seguras de repetir): portadas por URL/versión y etiqueta «próximamente»
ALTER TABLE games ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS cover_ver INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_tag_check;
ALTER TABLE games ADD CONSTRAINT games_tag_check CHECK (tag IN ('nuevo', 'oferta', 'proximamente'));
UPDATE games SET cover_url = '/assets/games/free-fire.jpg' WHERE slug = 'free-fire' AND cover_url IS NULL AND cover_type IS NULL;
UPDATE games SET cover_url = '/assets/games/mobile-legends.jpg' WHERE slug = 'mobile-legends' AND cover_url IS NULL AND cover_type IS NULL;
UPDATE games SET cover_url = '/assets/games/arena-breakout.jpg' WHERE slug = 'arena-breakout' AND cover_url IS NULL AND cover_type IS NULL;
UPDATE games SET cover_url = '/assets/games/blood-strike.svg' WHERE slug = 'blood-strike' AND cover_url IS NULL AND cover_type IS NULL;
