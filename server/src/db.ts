import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
import fs from 'fs';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'hotnews.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE,
      category TEXT DEFAULT '通用',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hotspots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      source TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      keyword_match TEXT DEFAULT '',
      category TEXT DEFAULT '',
      ai_verified INTEGER DEFAULT 0,
      ai_score REAL DEFAULT 0,
      ai_summary TEXT DEFAULT '',
      is_fake INTEGER DEFAULT 0,
      keyword_mentioned INTEGER DEFAULT 0,
      importance TEXT DEFAULT 'low',
      relevance_reason TEXT DEFAULT '',
      published_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Add columns if upgrading from older schema
    ALTER TABLE hotspots ADD COLUMN keyword_mentioned INTEGER DEFAULT 0;
    ALTER TABLE hotspots ADD COLUMN importance TEXT DEFAULT 'low';
    ALTER TABLE hotspots ADD COLUMN relevance_reason TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'hotspot',
      title TEXT NOT NULL,
      message TEXT DEFAULT '',
      hotspot_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (hotspot_id) REFERENCES hotspots(id) ON DELETE SET NULL
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_hotspots_category ON hotspots(category);
    CREATE INDEX IF NOT EXISTS idx_hotspots_verified ON hotspots(ai_verified);
    CREATE INDEX IF NOT EXISTS idx_hotspots_created ON hotspots(created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_keywords_active ON keywords(active);
  `);

  console.log('✅ Database initialized at', dbPath);
}

export default db;
