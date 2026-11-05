import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function openLocalDb(file) {
  await mkdir(dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file); sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  for (const migration of journal.entries) {
    if (sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(migration.tag)) continue;
    const sql = await readFile(new URL(`../drizzle/${migration.tag}.sql`, import.meta.url), 'utf8');
    sqlite.exec('BEGIN');
    try { sqlite.exec(sql); sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(migration.tag); sqlite.exec('COMMIT'); }
    catch (error) { sqlite.exec('ROLLBACK'); sqlite.close(); throw error; }
  }
  // Match the small D1 surface used by the shared repository.
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql); let values = [];
      return { bind(...args) { values = args; return this; }, async first() { return statement.get(...values) ?? null; }, async all() { return { results: statement.all(...values) }; }, async run() { const result = statement.run(...values); return { meta: { changes: Number(result.changes) } }; } };
    },
    close() { sqlite.close(); },
  };
}
