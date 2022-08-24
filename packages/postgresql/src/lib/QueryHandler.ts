import { SerializeJSON, toRaw } from '@joshdb/serialize';
import type { Sql } from 'postgres';
import postgres from 'postgres';
import type { PostgreSQLProvider } from './PostgreSQLProvider';

export class QueryHandler<StoredValue = unknown> {
  public options: QueryHandler.Options;

  public sql: Sql<Record<string, unknown>>;

  public constructor(options: QueryHandler.Options) {
    const { connectionDetails } = options;

    this.options = options;

    if (typeof connectionDetails === 'string') this.sql = postgres(connectionDetails);
    else {
      const { host, port, database, user, password } = connectionDetails;

      this.sql = postgres({ host, port, database, user, password });
    }
  }

  public async init(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS "data" (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        version VARCHAR(255) NOT NULL
      )
    `;
  }

  public async clear(): Promise<void> {
    const keys = await this.keys();

    await this.deleteMany(keys);
  }

  public async delete(key: string): Promise<void> {
    await this.sql`
      DELETE FROM "data"
      WHERE key = ${key}`;
  }

  public async deleteMany(keys: string[]): Promise<void> {
    await this.sql`
      DELETE FROM "data"
      WHERE key (
      IN ${this.sql(keys)}
      )`;
  }

  public async entries(): Promise<[string, StoredValue][]> {
    const { disableSerialization } = this.options;
    const rows = await this.sql<QueryHandler.RowData[]>`
      SELECT key, value
      FROM "data"
    `;

    return rows.map((row) => [row.key, disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value))]);
  }

  public async has(key: string): Promise<boolean> {
    const [{ exists }] = await this.sql<[QueryHandler.RowExists]>`
      SELECT EXISTS (
        SELECT 1
        FROM "data"
        WHERE key = ${key}
      )
    `;

    return exists;
  }

  public async keys(): Promise<string[]> {
    await this.init();

    const rows = await this.sql<Omit<QueryHandler.RowData, 'value' | 'version'>[]>`
      SELECT key
      FROM "data"
    `;

    return rows.map((row) => row.key);
  }

  public async get(key: string): Promise<StoredValue | undefined> {
    const { disableSerialization } = this.options;

    if (!(await this.has(key))) return;

    const [row] = await this.sql<QueryHandler.RowData[]>`
      SELECT *
      FROM "data"
      WHERE key = ${key}
    `;

    return disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value));
  }

  public async getMany(keys: string[]): Promise<Record<string, StoredValue | null>> {
    const { disableSerialization } = this.options;
    const rows = await this.sql<QueryHandler.RowData[]>`
      SELECT *
      FROM "data"
      WHERE key
      IN ${this.sql(keys)}
    `;

    return keys.reduce<Record<string, StoredValue | null>>((data, key) => {
      if (!rows.some((row) => row.key === key)) return { ...data, [key]: null };

      const row = rows.find((row) => row.key === key)!;

      return { ...data, [key]: disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value)) };
    }, {});
  }

  public async set(key: string, value: StoredValue): Promise<void> {
    const { disableSerialization, version } = this.options;

    await this.sql`
      INSERT INTO "data" ${this.sql(
        { key, value: disableSerialization ? JSON.stringify(value) : JSON.stringify(toRaw(value as unknown as SerializeJSON)), version },
        'key',
        'value',
        'version'
      )}
      ON CONFLICT (key)
      DO UPDATE SET ${this.sql(
        { value: disableSerialization ? JSON.stringify(value) : JSON.stringify(toRaw(value as unknown as SerializeJSON)), version },
        'value',
        'version'
      )}
    `;
  }

  public async setMany(entries: [string, StoredValue][], overwrite: boolean): Promise<void> {
    const { disableSerialization, version } = this.options;

    if (overwrite) {
      await this.sql`
      INSERT INTO "data" ${this.sql(
        entries.map(([key, value]) => ({
          key,
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(toRaw(value as unknown as SerializeJSON)),
          version
        })),
        'key',
        'value',
        'version'
      )}
      ON CONFLICT (key)
      DO UPDATE SET ${this.sql(
        entries.map(([, value]) => ({
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(toRaw(value as unknown as SerializeJSON)),
          version
        })),
        'value',
        'version'
      )}
    `;
    } else {
      await this.sql`
      INSERT INTO "data" ${this.sql(
        entries.map(([key, value]) => ({
          key,
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(toRaw(value as unknown as SerializeJSON)),
          version
        })),
        'key',
        'value',
        'version'
      )}
      ON CONFLICT DO NOTHING
      `;
    }
  }

  public async size(): Promise<number> {
    await this.init();

    const [{ count }] = await this.sql<[QueryHandler.RowCount]>`
      SELECT COUNT(*)
      FROM "data"
    `;

    return Number(count);
  }

  public async values(): Promise<StoredValue[]> {
    const { disableSerialization } = this.options;
    const rows = await this.sql<Omit<QueryHandler.RowData, 'key' | 'version'>[]>`
      SELECT value
      FROM "data"
    `;

    return rows.map((row) => (disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value))));
  }
}

export namespace QueryHandler {
  export interface Options {
    connectionDetails: PostgreSQLProvider.ConnectionDetails | string;

    disableSerialization?: boolean;

    version: string;
  }

  export interface RowData {
    key: string;

    value: string;

    version: string;
  }

  export interface RowExists {
    exists: boolean;
  }

  export interface RowCount {
    count: string;
  }
}
