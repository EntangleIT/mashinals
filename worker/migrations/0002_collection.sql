-- Official Mashinals 1Sat collection (GatchaGo-style parent + items).
CREATE TABLE IF NOT EXISTS collection_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  collection_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1000000,
  next_mint_number INTEGER NOT NULL DEFAULT 1,
  cover_txid TEXT,
  updated_at INTEGER NOT NULL
);
