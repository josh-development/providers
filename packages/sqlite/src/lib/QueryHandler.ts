import { Serialize } from '@joshdb/serialize';
import type Database from 'better-sqlite3';

export class QueryHandler<StoredValue = unknown> {
  public options: QueryHandler.Options;

  public database: Database.Database;

  public constructor(options: QueryHandler.Options) {
    this.options = options;

    const { database, tableName, wal, version, disableSerialization } = options;

    this.database = database;

    this.database.prepare(`CREATE TABLE IF NOT EXISTS '${tableName}' (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();

    this.database.pragma('synchronous = 1');

    if (wal) this.database.pragma('journal_mode = wal');
    else this.database.pragma('journal_mode = delete');

    this.database
      .prepare(`CREATE TABLE IF NOT EXISTS 'internal_metadata' (name TEXT PRIMARY KEY, version TEXT, autoKeyCount INTEGER, serializedKeys TEXT)`)
      .run();

    const result = this.database
      .prepare<Pick<QueryHandler.MetadataRow, 'name'>>(`SELECT EXISTS (SELECT 1 FROM 'internal_metadata' WHERE name = @name)`)
      .get({ name: tableName }) as MetadataRowExistsResult;

    if (result[Result.MetadataRowExists] === 0) {
      this.database
        .prepare<QueryHandler.MetadataRow>(
          `INSERT INTO 'internal_metadata' (name, version, autoKeyCount, serializedKeys) VALUES (@name, @version, @autoKeyCount, @serializedKeys)`
        )
        .run({
          name: tableName,
          version,
          autoKeyCount: 0,
          serializedKeys: JSON.stringify([])
        });
    }

    const metadata = this.database
      .prepare<Pick<QueryHandler.MetadataRow, 'name'>>(`SELECT serializedKeys FROM 'internal_metadata' WHERE name = @name`)
      .get({
        name: tableName
      }) as Pick<QueryHandler.MetadataRow, 'serializedKeys'>;

    const serializedKeys = JSON.parse(metadata.serializedKeys) as string[];

    if (serializedKeys.length && disableSerialization) {
      for (const [key, value] of this.entries()) this.set(key, Serialize.fromJSON(value as Serialize.JSON));

      this.database
        .prepare<Pick<QueryHandler.MetadataRow, 'name' | 'serializedKeys'>>(
          `UPDATE 'internal_metadata' SET serializedKeys = @serializedKeys WHERE name = @name`
        )
        .run({
          name: tableName,
          serializedKeys: JSON.stringify([])
        });
    } else if (!serializedKeys.length && !disableSerialization) {
      const entries = this.entries();

      for (const [key, value] of this.entries()) this.set(key, Serialize.toJSON(value));

      this.database
        .prepare<Pick<QueryHandler.MetadataRow, 'name' | 'serializedKeys'>>(
          `UPDATE 'internal_metadata' SET serializedKeys = @serializedKeys WHERE name = @name`
        )
        .run({
          name: tableName,
          serializedKeys: JSON.stringify(entries.map(([key]) => key))
        });
    }
  }

  public autoKey(): string {
    const { tableName } = this.options;
    let { autoKeyCount } = this.database
      .prepare<Pick<QueryHandler.MetadataRow, 'name'>>(`SELECT autoKeyCount FROM 'internal_metadata' WHERE name = @name`)
      .get({ name: tableName }) as Pick<QueryHandler.MetadataRow, 'autoKeyCount'>;

    autoKeyCount++;

    this.database
      .prepare<Pick<QueryHandler.MetadataRow, 'name' | 'autoKeyCount'>>(
        `UPDATE 'internal_metadata' SET autoKeyCount = @autoKeyCount WHERE name = @name`
      )
      .run({ name: tableName, autoKeyCount });

    return autoKeyCount.toString();
  }

  public clear(): void {
    const { tableName, version } = this.options;

    this.database.prepare(`DELETE FROM '${tableName}'`).run();
    this.database.prepare<Pick<QueryHandler.MetadataRow, 'name'>>(`DELETE FROM 'internal_metadata' WHERE name = @name`).run({ name: tableName });
    this.database
      .prepare<QueryHandler.MetadataRow>(
        `INSERT INTO 'internal_metadata' (name, version, autoKeyCount, serializedKeys) VALUES (@name, @version, @autoKeyCount, @serializedKeys)`
      )
      .run({
        name: tableName,
        version,
        autoKeyCount: 0,
        serializedKeys: JSON.stringify([])
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
      .prepare(`SELECT * FROM '${tableName}'`)
      .all()
      .map((row: QueryHandler.Row) => [row.key, disableSerialization ? JSON.parse(row.value) : Serialize.fromJSON(JSON.parse(row.value))]);
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

    return disableSerialization ? JSON.parse(row.value) : Serialize.fromJSON(JSON.parse(row.value));
  }

  public getMany(keys: string[]): Record<string, StoredValue | null> {
    const { tableName, disableSerialization } = this.options;

    return this.database
      .prepare(`SELECT * FROM '${tableName}' WHERE key IN (${keys.map(() => '?').join(', ')})`)
      .all(keys)
      .reduce<Record<string, StoredValue | null>>((obj, row: QueryHandler.Row) => {
        obj[row.key] = disableSerialization ? JSON.parse(row.value) : Serialize.fromJSON(JSON.parse(row.value));
        return obj;
      }, {});
  }

  public set<Value = StoredValue>(key: string, value: Value): void {
    const { tableName, disableSerialization } = this.options;

    this.database
      .prepare<QueryHandler.Row>(
        `INSERT OR REPLACE INTO '${tableName}' (key, value) VALUES (@key, @value) ON CONFLICT (key) DO UPDATE SET value = excluded.value`
      )
      .run({
        key,
        value: JSON.stringify(disableSerialization ? value : Serialize.toJSON(value))
      });

    const row = this.database
      .prepare<Pick<QueryHandler.MetadataRow, 'name'>>(`SELECT serializedKeys FROM 'internal_metadata' WHERE name = @name`)
      .get({ name: tableName }) as Pick<QueryHandler.MetadataRow, 'serializedKeys'>;

    const serializedKeys = JSON.parse(row.serializedKeys) as string[];

    if (!serializedKeys.includes(key)) {
      serializedKeys.push(key);

      this.database
        .prepare<Pick<QueryHandler.MetadataRow, 'name' | 'serializedKeys'>>(
          `UPDATE 'internal_metadata' SET serializedKeys = @serializedKeys WHERE name = @name`
        )
        .run({ name: tableName, serializedKeys: JSON.stringify(serializedKeys) });
    }
  }

  public setMany(entries: [string, StoredValue][], overwrite: boolean): void {
    const { tableName, disableSerialization } = this.options;

    if (overwrite) {
      this.database
        .prepare(
          `INSERT INTO '${tableName}' (key, value) VALUES ${entries
            .map(() => '(?, ?)')
            .join(', ')} ON CONFLICT (key) DO UPDATE SET value = excluded.value`
        )
        .run(entries.flatMap(([key, value]) => [key, JSON.stringify(disableSerialization ? value : Serialize.toJSON(value))]));
    } else {
      this.database
        .prepare(`INSERT INTO '${tableName}' (key, value) VALUES ${entries.map(() => '(?, ?)').join(', ')} ON CONFLICT DO NOTHING`)
        .run(entries.flatMap(([key, value]) => [key, JSON.stringify(disableSerialization ? value : Serialize.toJSON(value))]));
    }

    const row = this.database
      .prepare<Pick<QueryHandler.MetadataRow, 'name'>>(`SELECT serializedKeys FROM 'internal_metadata' WHERE name = @name`)
      .get({ name: tableName }) as Pick<QueryHandler.MetadataRow, 'serializedKeys'>;

    const serializedKeys = JSON.parse(row.serializedKeys) as string[];
    const { length } = serializedKeys;

    for (const [key] of entries) {
      if (!serializedKeys.includes(key)) {
        serializedKeys.push(key);
      }
    }

    if (serializedKeys.length !== length) {
      this.database
        .prepare<Pick<QueryHandler.MetadataRow, 'name' | 'serializedKeys'>>(
          `UPDATE 'internal_metadata' SET serializedKeys = @serializedKeys WHERE name = @name`
        )
        .run({
          name: tableName,
          serializedKeys: JSON.stringify(row.serializedKeys)
        });
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
      .map((row: Pick<QueryHandler.Row, 'value'>) => (disableSerialization ? JSON.parse(row.value) : Serialize.fromJSON(JSON.parse(row.value))));
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
  }

  export interface MetadataRow {
    name: string;

    version: string;

    autoKeyCount: number;

    serializedKeys: string;
  }
}

enum Result {
  MetadataRowExists = "EXISTS (SELECT 1 FROM 'internal_metadata' WHERE name = @name)",

  Count = 'COUNT(*)'
}

interface MetadataRowExistsResult {
  [Result.MetadataRowExists]: number;
}

interface CountResult {
  [Result.Count]: number;
}
