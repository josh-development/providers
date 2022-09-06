import { toJSON, toRaw } from '@joshdb/serialize';
import type Database from 'better-sqlite3';

export class QueryHandler<StoredValue = unknown> {
  public options: QueryHandler.Options;

  public database: Database.Database;

  public constructor(options: QueryHandler.Options) {
    this.options = options;

    const { database, tableName, wal } = options;

    this.database = database;

    this.database.prepare(`CREATE TABLE IF NOT EXISTS '${tableName}' (key TEXT PRIMARY KEY, value TEXT NOT NULL, version TEXT NOT NULL)`).run();

    this.database.pragma('synchronous = 1');

    if (wal) this.database.pragma('journal_mode = wal');
    else this.database.pragma('journal_mode = delete');

    this.database.prepare(`CREATE TABLE IF NOT EXISTS 'internal:autoKey' (name TEXT PRIMARY KEY, lastKey INTEGER)`).run();

    const result = this.database
      .prepare<Pick<AutoKeyRow, 'name'>>(`SELECT EXISTS (SELECT 1 FROM 'internal:autoKey' WHERE name = @name)`)
      .get({ name: tableName }) as AutoKeyRowExistsResult;

    if (result[Result.AutoKeyRowExists] === 0) {
      this.database.prepare(`INSERT INTO 'internal:autoKey' (name, lastKey) VALUES (@name, @lastKey)`).run({
        name: tableName,
        lastKey: 0
      });
    }
  }

  public autoKey(): string {
    const { tableName } = this.options;
    let { lastKey } = this.database
      .prepare<Pick<AutoKeyRow, 'name'>>(`SELECT lastKey FROM 'internal:autoKey' WHERE name = @name`)
      .get({ name: tableName }) as Pick<AutoKeyRow, 'lastKey'>;

    lastKey++;

    this.database.prepare<AutoKeyRow>(`UPDATE 'internal:autoKey' SET lastKey = @lastKey WHERE name = @name`).run({ name: tableName, lastKey });

    return lastKey.toString();
  }

  public clear(): void {
    const { tableName } = this.options;

    this.database.prepare(`DELETE FROM '${tableName}'`).run();
    this.database.prepare<Pick<AutoKeyRow, 'name'>>(`DELETE FROM 'internal:autoKey' WHERE name = @name`).run({ name: tableName });
    this.database.prepare<AutoKeyRow>(`INSERT INTO 'internal:autoKey' (name, lastKey) VALUES (@name, @lastKey)`).run({
      name: tableName,
      lastKey: 0
    });
  }

  public delete(key: string): void {
    const { tableName } = this.options;

    this.database.prepare<Pick<QueryHandler.Row, 'key'>>(`DELETE FROM '${tableName}' WHERE key = @key`).run({ key });
  }

  public deleteMany(keys: string[]): void {
    const { tableName } = this.options;

    this.database.prepare(`DELETE FROM '${tableName}' WHERE key IN (${keys.map(() => '?').join(', ')})`).run(keys);
  }

  public entries(): [string, StoredValue][] {
    const { tableName, disableSerialization } = this.options;

    return this.database
      .prepare(`SELECT key, value FROM '${tableName}'`)
      .all()
      .map((row: Omit<QueryHandler.Row, 'version'>) => [row.key, disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value))]);
  }

  public has(key: string): boolean {
    const { tableName } = this.options;

    return (
      this.database.prepare<Pick<QueryHandler.Row, 'key'>>(`SELECT EXISTS (SELECT 1 FROM '${tableName}' WHERE key = @key)`).get({ key })[
        `EXISTS (SELECT 1 FROM '${tableName}' WHERE key = @key)`
      ] === 1
    );
  }

  public keys(): string[] {
    const { tableName } = this.options;

    return this.database
      .prepare(`SELECT key FROM '${tableName}'`)
      .all()
      .map((row: Pick<QueryHandler.Row, 'key'>) => row.key);
  }

  public get(key: string): StoredValue | undefined {
    const { tableName, disableSerialization } = this.options;
    const row = this.database.prepare<Pick<QueryHandler.Row, 'key'>>(`SELECT value FROM '${tableName}' WHERE key = @key`).get({ key }) as Pick<
      QueryHandler.Row,
      'value'
    >;

    if (!row) return undefined;

    return disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value));
  }

  public getMany(keys: string[]): Record<string, StoredValue | null> {
    const { tableName, disableSerialization } = this.options;

    return this.database
      .prepare(`SELECT key, value FROM '${tableName}' WHERE key IN (${keys.map(() => '?').join(', ')})`)
      .all(keys)
      .reduce<Record<string, StoredValue | null>>((obj, row: Omit<QueryHandler.Row, 'version'>) => {
        obj[row.key] = disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value));
        return obj;
      }, {});
  }

  public set<Value = StoredValue>(key: string, value: Value): void {
    const { tableName, version, disableSerialization } = this.options;

    this.database
      .prepare(
        `INSERT OR REPLACE INTO '${tableName}' (key, value, version) VALUES (@key, @value, @version) ON CONFLICT (key) DO UPDATE SET value = excluded.value`
      )
      .run({
        key,
        value: JSON.stringify(disableSerialization ? value : toJSON(value)),
        version
      });
  }

  public setMany(entries: [string, StoredValue][], overwrite: boolean): void {
    const { tableName, version, disableSerialization } = this.options;

    if (overwrite) {
      this.database
        .prepare(
          `INSERT INTO '${tableName}' (key, value, version) VALUES ${entries
            .map(() => '(?, ?, ?)')
            .join(', ')} ON CONFLICT (key) DO UPDATE SET value = excluded.value`
        )
        .run(entries.flatMap(([key, value]) => [key, JSON.stringify(disableSerialization ? value : toJSON(value)), version]));
    } else {
      this.database
        .prepare(`INSERT INTO '${tableName}' (key, value, version) VALUES ${entries.map(() => '(?, ?, ?)').join(', ')} ON CONFLICT DO NOTHING`)
        .run(entries.flatMap(([key, value]) => [key, JSON.stringify(disableSerialization ? value : toJSON(value)), version]));
    }
  }

  public size(): number {
    const { tableName } = this.options;
    const result = this.database.prepare(`SELECT COUNT(*) FROM '${tableName}'`).get() as CountResult;

    return result[Result.Count];
  }

  public values(): StoredValue[] {
    const { tableName, disableSerialization } = this.options;

    return this.database
      .prepare(`SELECT value FROM '${tableName}'`)
      .all()
      .map((row: Pick<QueryHandler.Row, 'value'>) => (disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value))));
  }
}

export namespace QueryHandler {
  export interface Options {
    database: Database.Database;

    tableName: string;

    wal: boolean;

    disableSerialization: boolean;

    version: string;
  }

  export interface Row {
    key: string;

    value: string;

    version: string;
  }
}

export interface AutoKeyRow {
  name: string;

  lastKey: number;
}

export enum Result {
  AutoKeyRowExists = "EXISTS (SELECT 1 FROM 'internal:autoKey' WHERE name = @name)",

  Count = 'COUNT(*)'
}

export interface AutoKeyRowExistsResult {
  [Result.AutoKeyRowExists]: number;
}

export interface CountResult {
  [Result.Count]: number;
}
