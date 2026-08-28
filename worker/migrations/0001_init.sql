CREATE TABLE IF NOT EXISTS recipes (
  recipe_key TEXT PRIMARY KEY,
  parent_a_id TEXT NOT NULL,
  parent_b_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  child_name TEXT NOT NULL,
  first_discovered_at INTEGER NOT NULL,
  discovery_count INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inscriptions (
  id TEXT NOT NULL,
  origin TEXT PRIMARY KEY,
  txid TEXT NOT NULL,
  name TEXT NOT NULL,
  caption TEXT NOT NULL,
  generation INTEGER NOT NULL,
  parent_a_name TEXT,
  parent_b_name TEXT,
  parent_a_origin TEXT,
  parent_b_origin TEXT,
  recipe_key TEXT,
  svg_hash TEXT,
  spec_json TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  inscribed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inscriptions_time ON inscriptions(inscribed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_child ON recipes(child_id);
