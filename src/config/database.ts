import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { env } from "./env.js";

function resolveDatabasePath(databasePath: string): string {
  if (databasePath === ":memory:") {
    return databasePath;
  }

  if (path.isAbsolute(databasePath)) {
    return databasePath;
  }

  return path.resolve(process.cwd(), databasePath);
}

function ensureDirectoryExists(filePath: string): void {
  if (filePath === ":memory:") {
    return;
  }

  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

function loadSchemaSql(): string {
  const schemaPath = path.resolve(process.cwd(), "database/schema.sql");

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`SQLite schema file not found at ${schemaPath}`);
  }

  return fs.readFileSync(schemaPath, "utf8");
}

export const databasePath = resolveDatabasePath(env.databasePath);

ensureDirectoryExists(databasePath);

export const db: Database.Database = new Database(databasePath, {
  timeout: 5_000,
});

db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec(loadSchemaSql());

export function closeDatabase(): void {
  if (db.open) {
    db.close();
  }
}
