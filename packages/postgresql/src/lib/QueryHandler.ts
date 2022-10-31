import { Serialize } from '@joshdb/serialize';
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

      this.sql = postgres({ host, port, database, user, password, onnotice: () => null, transform: { undefined: null } });
    }
  }

  public async init(): Promise<void> {
    const { tableName, version } = this.options;

    await this.sql`
      CREATE TABLE IF NOT EXISTS ${this.sql(tableName)} (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS internal_metadata (
        name VARCHAR(255) PRIMARY KEY,
        version VARCHAR(255) NOT NULL,
        metadata TEXT NOT NULL
      )
    `;

    await this.sql`
      INSERT INTO internal_metadata ${this.sql({ name: tableName, version, metadata: JSON.stringify({}) }, 'name', 'version', 'metadata')}
      ON CONFLICT DO NOTHING
    `;
  }

  public async deleteMetadata(key: string): Promise<void> {
    const metadata = JSON.parse((await this.fetchMetadata()).metadata) as Record<string, unknown>;

    Reflect.deleteProperty(metadata, key);

    await this.sql`
      UPDATE internal_metadata
      SET ${this.sql({ metadata: JSON.stringify(metadata) }, 'metadata')}
    `;
  }

  public async getMetadata(key: string): Promise<unknown> {
    const metadata = JSON.parse((await this.fetchMetadata()).metadata) as Record<string, unknown>;

    return metadata[key];
  }

  public async setMetadata(key: string, value: unknown): Promise<void> {
    const { tableName } = this.options;
    const metadata = JSON.parse((await this.fetchMetadata()).metadata) as Record<string, unknown>;

    metadata[key] = value;

    await this.sql`
      UPDATE internal_metadata
      WHERE name = $${tableName}
      SET ${this.sql({ metadata: JSON.stringify(metadata) }, 'metadata')}
    `;
  }

  public async clear(): Promise<void> {
    const { tableName } = this.options;

    await this.sql`
      DELETE FROM ${this.sql(tableName)}
    `;
  }

  public async delete(key: string): Promise<void> {
    const { tableName } = this.options;

    await this.sql`
      DELETE FROM ${this.sql(tableName)}
      WHERE key = ${key}`;
  }

  public async deleteMany(keys: string[]): Promise<void> {
    const { tableName } = this.options;

    await this.sql`
      DELETE FROM ${this.sql(tableName)}
      WHERE key
      IN ${this.sql(keys)}
      `;
  }

  public async entries(): Promise<[string, StoredValue][]> {
    const { tableName, disableSerialization } = this.options;
    const rows = await this.sql<QueryHandler.Row[]>`
      SELECT key, value
      FROM ${this.sql(tableName)}
    `;

    return rows.map((row) => [row.key, disableSerialization ? JSON.parse(row.value) : Serialize.fromJSON(JSON.parse(row.value))]);
  }

  public async has(key: string): Promise<boolean> {
    const { tableName } = this.options;
    const [{ exists }] = await this.sql<[QueryHandler.RowExists]>`
      SELECT EXISTS (
        SELECT 1
        FROM ${this.sql(tableName)}
        WHERE key = ${key}
      )
    `;

    return exists;
  }

  public async keys(): Promise<string[]> {
    const { tableName } = this.options;
    const rows = await this.sql<Pick<QueryHandler.Row, 'key'>[]>`
      SELECT key
      FROM ${this.sql(tableName)}
    `;

    return rows.map((row) => row.key);
  }

  public async get(key: string): Promise<StoredValue | undefined> {
    const { tableName, disableSerialization } = this.options;

    if (!(await this.has(key))) return;

    const [row] = await this.sql<QueryHandler.Row[]>`
      SELECT *
      FROM ${this.sql(tableName)}
      WHERE key = ${key}
    `;

    return disableSerialization ? JSON.parse(row.value) : Serialize.fromJSON(JSON.parse(row.value));
  }

  public async getMany(keys: string[]): Promise<Record<string, StoredValue | null>> {
    const { tableName, disableSerialization } = this.options;
    const rows = await this.sql<QueryHandler.Row[]>`
      SELECT *
      FROM ${this.sql(tableName)}
      WHERE key
      IN ${this.sql(keys)}
    `;

    return keys.reduce<Record<string, StoredValue | null>>((data, key) => {
      if (!rows.some((row) => row.key === key)) return { ...data, [key]: null };

      const row = rows.find((row) => row.key === key)!;

      return { ...data, [key]: disableSerialization ? JSON.parse(row.value) : Serialize.fromJSON(JSON.parse(row.value)) };
    }, {});
  }

  public async set(key: string, value: StoredValue): Promise<void> {
    const { tableName, disableSerialization } = this.options;

    await this.sql`
      INSERT INTO ${this.sql(tableName)} ${this.sql(
      { key, value: disableSerialization ? JSON.stringify(value) : JSON.stringify(Serialize.toJSON(value)) },
      'key',
      'value'
    )}
      ON CONFLICT (key)
      DO UPDATE SET ${this.sql({ value: disableSerialization ? JSON.stringify(value) : JSON.stringify(Serialize.toJSON(value)) }, 'value')}
    `;
  }

  public async setMany(entries: [string, StoredValue][], overwrite: boolean): Promise<void> {
    const { tableName, disableSerialization } = this.options;

    if (overwrite) {
      await this.sql`
      INSERT INTO ${this.sql(tableName)}
      ${this.sql(
        entries.map(([key, value]) => ({
          key,
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(Serialize.toJSON(value))
        })),
        'key',
        'value'
      )}
      ON CONFLICT (key)
      DO UPDATE SET
      value = excluded.value
    `;
    } else {
      await this.sql`
      INSERT INTO ${this.sql(tableName)}
      ${this.sql(
        entries.map(([key, value]) => ({
          key,
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(Serialize.toJSON(value))
        })),
        'key',
        'value'
      )}
      ON CONFLICT DO NOTHING
      `;
    }
  }

  public async size(): Promise<number> {
    const { tableName } = this.options;
    const [{ count }] = await this.sql<[QueryHandler.RowCount]>`
      SELECT COUNT(*)
      FROM ${this.sql(tableName)}
    `;

    return Number(count);
  }

  public async values(): Promise<StoredValue[]> {
    const { tableName, disableSerialization } = this.options;
    const rows = await this.sql<Pick<QueryHandler.Row, 'value'>[]>`
      SELECT value
      FROM ${this.sql(tableName)}
    `;

    return rows.map((row) => (disableSerialization ? JSON.parse(row.value) : Serialize.fromJSON(JSON.parse(row.value))));
  }

  public async fetchMetadata(): Promise<QueryHandler.MetadataRow> {
    const { tableName } = this.options;
    const [row] = await this.sql<QueryHandler.MetadataRow[]>`
      SELECT *
      FROM internal_metadata
      WHERE name = ${tableName}
    `;

    return row;
  }
}

export namespace QueryHandler {
  export interface Options {
    tableName: string;

    connectionDetails: PostgreSQLProvider.ConnectionDetails | string;

    disableSerialization?: boolean;

    version: string;
  }

  export interface Row {
    key: string;

    value: string;
  }

  export interface MetadataRow {
    name: string;

    version: string;

    metadata: string;
  }

  export interface RowExists {
    exists: boolean;
  }

  export interface RowCount {
    count: string;
  }
}
