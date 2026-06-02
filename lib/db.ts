import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// NOTE: better-sqlite3 uses the local filesystem.
// For Vercel/serverless production, replace this layer with
// Vercel Postgres, PlanetScale, Turso, or any cloud database.
const DATA_DIR =
  process.env.MMC_USER_DATA                           // Electron (packaged) → %APPDATA%/MineModCraft Studio/data
    ? path.join(process.env.MMC_USER_DATA, "data")
  : (process.env.VERCEL || process.env.VERCEL_ENV)    // Vercel serverless → /tmp/data
    ? "/tmp/data"
  : path.join(process.cwd(), "data");                 // 通常 (next dev / next start)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(path.join(DATA_DIR, "mmc.db"));
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT    UNIQUE NOT NULL,
      email          TEXT    UNIQUE NOT NULL,
      password_hash  TEXT,
      age            INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pending_verifications (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT    NOT NULL,
      email          TEXT    UNIQUE NOT NULL,
      password_hash  TEXT    NOT NULL,
      age            INTEGER NOT NULL,
      code           TEXT    NOT NULL,
      expires_at     TEXT    NOT NULL,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      data        TEXT    NOT NULL DEFAULT '{}',
      platform    TEXT    NOT NULL DEFAULT 'bedrock',
      mc_version  TEXT    NOT NULL DEFAULT '1.26.x',
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // google_id 列を後方互換で追加
  try { db.exec("ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT"); } catch {}
}

/* ─── Types ─── */

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string | null;
  age: number;
  google_id?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  data: string;
  platform: string;
  mc_version: string;
  updated_at: string;
  created_at: string;
}

export interface PendingVerification {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  age: number;
  code: string;
  expires_at: string;
  created_at: string;
}

/* ─── Operations ─── */

export const db = {
  /* Users */

  getUserByEmail(email: string): User | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as User | undefined;
  },

  getUserByUsername(username: string): User | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as User | undefined;
  },

  getUserById(id: number): User | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as User | undefined;
  },

  createUser(data: Pick<User, "username" | "email" | "password_hash" | "age">): User {
    return getDb()
      .prepare(
        "INSERT INTO users (username, email, password_hash, age) VALUES (?, ?, ?, ?) RETURNING *"
      )
      .get(data.username, data.email, data.password_hash, data.age) as User;
  },

  /* Pending verifications */

  upsertPending(data: Omit<PendingVerification, "id" | "created_at">): void {
    const d = getDb();
    d.prepare("DELETE FROM pending_verifications WHERE email = ?").run(data.email);
    d.prepare(
      "INSERT INTO pending_verifications (username, email, password_hash, age, code, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(data.username, data.email, data.password_hash, data.age, data.code, data.expires_at);
  },

  getPending(email: string): PendingVerification | undefined {
    return getDb()
      .prepare("SELECT * FROM pending_verifications WHERE email = ?")
      .get(email) as PendingVerification | undefined;
  },

  deletePending(email: string): void {
    getDb().prepare("DELETE FROM pending_verifications WHERE email = ?").run(email);
  },

  cleanupExpired(): void {
    getDb()
      .prepare("DELETE FROM pending_verifications WHERE expires_at < datetime('now')")
      .run();
  },

  /* Google OAuth */
  getUserByGoogleId(googleId: string): User | undefined {
    return getDb().prepare("SELECT * FROM users WHERE google_id = ?").get(googleId) as User | undefined;
  },

  createGoogleUser(data: { username: string; email: string; google_id: string; avatar_url?: string }): User {
    return getDb()
      .prepare("INSERT INTO users (username, email, password_hash, age, google_id, avatar_url) VALUES (?,?,NULL,0,?,?) RETURNING *")
      .get(data.username, data.email, data.google_id, data.avatar_url ?? null) as User;
  },

  linkGoogleId(userId: number, googleId: string, avatarUrl?: string): void {
    getDb().prepare("UPDATE users SET google_id=?, avatar_url=? WHERE id=?").run(googleId, avatarUrl ?? null, userId);
  },

  /* Projects */
  getUserProjects(userId: number): Project[] {
    return getDb().prepare("SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC").all(userId) as Project[];
  },

  getProject(id: number, userId: number): Project | undefined {
    return getDb().prepare("SELECT * FROM projects WHERE id=? AND user_id=?").get(id, userId) as Project | undefined;
  },

  upsertProject(userId: number, name: string, data: string, platform: string, mcVersion: string, projectId?: number): Project {
    const d = getDb();
    if (projectId) {
      return d.prepare(
        "UPDATE projects SET name=?,data=?,platform=?,mc_version=?,updated_at=datetime('now') WHERE id=? AND user_id=? RETURNING *"
      ).get(name, data, platform, mcVersion, projectId, userId) as Project;
    }
    return d.prepare(
      "INSERT INTO projects (user_id,name,data,platform,mc_version) VALUES (?,?,?,?,?) RETURNING *"
    ).get(userId, name, data, platform, mcVersion) as Project;
  },

  deleteProject(id: number, userId: number): void {
    getDb().prepare("DELETE FROM projects WHERE id=? AND user_id=?").run(id, userId);
  },
};
