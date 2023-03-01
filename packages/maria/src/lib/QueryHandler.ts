import { Serialize } from 'better-serialize';
import { Connection, ConnectionConfig, createConnection } from 'mariadb';

export class QueryHandler<StoredValue = unknown> {
  public options: QueryHandler.Options;

  #connection?: Connection;

  public constructor(options: QueryHandler.Options) {
    this.options = options;
  }

  public get connection() {
    if (!this.#connection) throw new Error('Client is not connected, most likely due to `init` not being called or the server not being available');
    return this.#connection;
  }

  public async init(): Promise<void> {
    this.#connection = await createConnection(this.options.connectionConfig);
    await this.ensureTable();
  }

  public async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
  }

  public async deleteMetadata(key: string): Promise<void> {
    const metadata = JSON.parse((await this.fetchMetadata()).metadata) as Record<string, unknown>;

    Reflect.deleteProperty(metadata, key);

    await this.connection.query(
      `
      UPDATE internal_metadata
      SET \`metadata\` = ? WHERE \`name\` = '${this.options.tableName}';
    `,
      [JSON.stringify(metadata)]
    );
  }

  public async getMetadata(key: string): Promise<unknown> {
    const metadata = JSON.parse((await this.fetchMetadata()).metadata) as Record<string, unknown>;

    return metadata[key];
  }

  public async setMetadata(key: string, value: unknown): Promise<void> {
    const metadata = JSON.parse((await this.fetchMetadata()).metadata) as Record<string, unknown>;

    metadata[key] = value;

    await this.connection.query(
      `
      UPDATE internal_metadata
      SET \`metadata\` = ? WHERE \`name\` = '${this.options.tableName}';
    `,
      [JSON.stringify(metadata)]
    );
  }

  public async clear(): Promise<void> {
    await this.connection.query(`
      DELETE FROM \`${this.options.tableName}\`;
    `);
  }

  public async delete(key: string): Promise<void> {
    await this.connection.query(`DELETE FROM \`${this.options.tableName}\` WHERE \`key\` = ?;`, [key]);
  }

  public async deleteMany(keys: string[]): Promise<void> {
    await this.connection.query(
      `
      DELETE FROM \`${this.options.tableName}\`
      WHERE \`key\`
      IN (?)`,
      [keys]
    );
  }

  public async entries(): Promise<[string, StoredValue][]> {
    const { disableSerialization } = this.options;
    const rows = (await this.connection.query(`
      SELECT * FROM \`${this.options.tableName}\`
    `)) as QueryHandler.RowData[];

    return rows.map((row) => [row.key, disableSerialization ? JSON.parse(row.value) : Serialize.fromJsonCompatible(JSON.parse(row.value))]);
  }

  public async has(key: string): Promise<boolean> {
    const rows = await this.connection.query(
      `
        SELECT 1
        FROM \`${this.options.tableName}\`
        WHERE \`key\` = ?;
    `,
      [key]
    );

    return Boolean(rows.length);
  }

  public async keys(): Promise<string[]> {
    const rows = (await this.connection.query(`
      SELECT \`key\`
      FROM \`${this.options.tableName}\`
    `)) as Omit<QueryHandler.RowData, 'value'>[];

    return rows.map((row) => row.key);
  }

  public async get(key: string): Promise<StoredValue | undefined> {
    const { disableSerialization } = this.options;

    if (!(await this.has(key))) return;

    const [row] = (await this.connection.query(
      `
      SELECT *
      FROM \`${this.options.tableName}\`
      WHERE \`key\` = ?
    `,
      [key]
    )) as QueryHandler.RowData[];

    return disableSerialization ? JSON.parse(row.value) : Serialize.fromJsonCompatible(JSON.parse(row.value));
  }

  public async getMany(keys: string[]): Promise<Record<string, StoredValue | null>> {
    const { disableSerialization } = this.options;
    const rows = (await this.connection.query(
      `
      SELECT *
      FROM \`${this.options.tableName}\`
      WHERE \`key\`
      IN (?)
    `,
      [keys]
    )) as QueryHandler.RowData[];

    const data: Record<string, StoredValue | null> = {};

    for (const { key, value } of rows) {
      data[key] = disableSerialization ? JSON.parse(value) : Serialize.fromJsonCompatible(JSON.parse(value));
    }

    for (const key of keys) {
      if (!data[key]) data[key] = null;
    }

    return data;
  }

  public async set<Value = StoredValue>(key: string, value: Value): Promise<void> {
    const { disableSerialization } = this.options;

    await this.connection.query(
      {
        namedPlaceholders: true,
        sql: `
      INSERT INTO \`${this.options.tableName}\` (\`key\`, \`value\`)
      VALUES (:key, :value)
      ON DUPLICATE KEY
      UPDATE \`value\` = :value;`
      },
      { key, value: disableSerialization ? JSON.stringify(value) : JSON.stringify(Serialize.toJsonCompatible(value)) }
    );
  }

  public async setMany(entries: [string, StoredValue][], overwrite: boolean): Promise<void> {
    const { disableSerialization } = this.options;

    if (overwrite) {
      await this.connection.batch(
        {
          namedPlaceholders: true,
          sql: `
      INSERT INTO \`${this.options.tableName}\` (\`key\`, \`value\`)
      VALUES (:key, :value)
      ON DUPLICATE KEY
      UPDATE \`value\` = :value;`
        },
        entries.map(([key, value]) => ({
          key,
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(Serialize.toJsonCompatible(value))
        }))
      );
    } else {
      await this.connection.batch(
        {
          namedPlaceholders: true,
          sql: `
      INSERT INTO \`${this.options.tableName}\` (\`key\`, \`value\`)
      VALUES (:key, :value)
      ON DUPLICATE KEY
      UPDATE \`key\` = \`key\`;`
        },
        entries.map(([key, value]) => ({
          key,
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(Serialize.toJsonCompatible(value))
        }))
      );
    }
  }

  public async size(): Promise<number> {
    const [{ count }] = (await this.connection.query(`
      SELECT COUNT(*) as count
      FROM \`${this.options.tableName}\`
    `)) as [QueryHandler.RowCount];

    return Number(count);
  }

  public async values(): Promise<StoredValue[]> {
    const { disableSerialization } = this.options;
    const rows = (await this.connection.query(`
      SELECT \`value\`
      FROM \`${this.options.tableName}\`
    `)) as Omit<QueryHandler.RowData, 'key'>[];

    return rows.map((row) => (disableSerialization ? JSON.parse(row.value) : Serialize.fromJsonCompatible(JSON.parse(row.value))));
  }

  public async fetchMetadata(): Promise<QueryHandler.MetadataRow> {
    const { tableName } = this.options;
    const [row] = (await this.connection.query(`
      SELECT *
      FROM internal_metadata
      WHERE name = '${tableName}'
    `)) as QueryHandler.MetadataRow[];

    return row;
  }

  private async ensureTable() {
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS \`${this.options.tableName}\` (
        \`key\` VARCHAR(512) PRIMARY KEY,
        \`value\` TEXT NOT NULL
      );
    `);

    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS internal_metadata (
        \`name\` VARCHAR(512) PRIMARY KEY,
        \`version\` VARCHAR(255) NOT NULL,
        \`metadata\` TEXT NOT NULL
      )
    `);

    await this.connection.query(
      `
      INSERT INTO internal_metadata (\`name\`, \`version\`, \`metadata\`) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE \`name\` = \`name\`;
    `,
      [this.options.tableName, this.options.version, '{}']
    );
  }
}

export namespace QueryHandler {
  export interface Options {
    connectionConfig: ConnectionConfig | string;

    tableName: string;

    disableSerialization?: boolean;

    version: string;
  }

  export interface RowData {
    key: string;

    value: string;
  }

  export interface RowCount {
    count: string;
  }

  export interface MetadataRow {
    name: string;

    version: string;

    serializedKeys: string;

    metadata: string;
  }
}
