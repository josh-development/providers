import { toJSON, toRaw } from '@joshdb/serialize';
import { Connection, ConnectionConfig, createConnection } from 'mariadb';

export class QueryHandler<StoredValue = unknown> {
  public options: QueryHandler.Options;

  public connection?: Connection;

  public constructor(options: QueryHandler.Options) {
    this.options = options;
  }

  public async init(): Promise<void> {
    this.connection = await createConnection(this.options.connectionConfig);
    await this.ensureTable();
  }

  public async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
  }

  public async clear(): Promise<void> {
    await this.connection!.query(`
      DELETE FROM \`${this.options.tableName}\`;
    `);
  }

  public async delete(key: string): Promise<void> {
    await this.connection!.query(`DELETE FROM \`${this.options.tableName}\` WHERE \`key\` = ?;`, [key]);
  }

  public async deleteMany(keys: string[]): Promise<void> {
    await this.connection!.query(
      `
      DELETE FROM \`${this.options.tableName}\`
      WHERE \`key\`
      IN (?)`,
      [keys]
    );
  }

  public async entries(): Promise<[string, StoredValue][]> {
    const { disableSerialization } = this.options;
    const rows = (await this.connection!.query(`
      SELECT * FROM \`${this.options.tableName}\`
    `)) as QueryHandler.RowData[];

    return rows.map((row) => [row.key, disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value))]);
  }

  public async has(key: string): Promise<boolean> {
    const rows = await this.connection!.query(
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
    const rows = (await this.connection!.query(`
      SELECT \`key\`
      FROM \`${this.options.tableName}\`
    `)) as Omit<QueryHandler.RowData, 'value' | 'version'>[];

    return rows.map((row) => row.key);
  }

  public async get(key: string): Promise<StoredValue | undefined> {
    const { disableSerialization } = this.options;

    if (!(await this.has(key))) return;

    const [row] = (await this.connection!.query(
      `
      SELECT *
      FROM \`${this.options.tableName}\`
      WHERE \`key\` = ?
    `,
      [key]
    )) as QueryHandler.RowData[];

    return disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value));
  }

  public async getMany(keys: string[]): Promise<Record<string, StoredValue | null>> {
    const { disableSerialization } = this.options;
    const rows = (await this.connection!.query(
      `
      SELECT *
      FROM \`${this.options.tableName}\`
      WHERE \`key\`
      IN (?)
    `,
      [keys]
    )) as QueryHandler.RowData[];

    return keys.reduce<Record<string, StoredValue | null>>((data, key) => {
      if (!rows.some((row) => row.key === key)) return { ...data, [key]: null };

      const row = rows.find((row) => row.key === key)!;

      return { ...data, [key]: disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value)) };
    }, {});
  }

  public async set<Value = StoredValue>(key: string, value: Value): Promise<void> {
    const { disableSerialization, version } = this.options;

    await this.connection!.query(
      {
        namedPlaceholders: true,
        sql: `
      INSERT INTO \`${this.options.tableName}\` (\`key\`, \`value\`, \`version\`)
      VALUES (:key, :value, :version)
      ON DUPLICATE KEY
      UPDATE \`value\` = :value, \`version\` = :version;`
      },
      { key, value: disableSerialization ? JSON.stringify(value) : JSON.stringify(toJSON(value)), version }
    );
  }

  public async setMany(entries: [string, StoredValue][], overwrite: boolean): Promise<void> {
    const { disableSerialization, version } = this.options;

    if (overwrite) {
      await this.connection!.batch(
        {
          namedPlaceholders: true,
          sql: `
      INSERT INTO \`${this.options.tableName}\` (\`key\`, \`value\`, \`version\`)
      VALUES (:key, :value, :version)
      ON DUPLICATE KEY
      UPDATE \`value\` = :value;`
        },
        entries.map(([key, value]) => ({
          key,
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(toJSON(value)),
          version
        }))
      );
    } else {
      await this.connection!.batch(
        {
          namedPlaceholders: true,
          sql: `
      INSERT INTO \`${this.options.tableName}\` (\`key\`, \`value\`, \`version\`)
      VALUES (:key, :value, :version)
      ON DUPLICATE KEY
      UPDATE \`key\` = \`key\`;`
        },
        entries.map(([key, value]) => ({
          key,
          value: disableSerialization ? JSON.stringify(value) : JSON.stringify(toJSON(value)),
          version
        }))
      );
    }
  }

  public async size(): Promise<number> {
    const [{ count }] = (await this.connection!.query(`
      SELECT COUNT(*) as count
      FROM \`${this.options.tableName}\`
    `)) as [QueryHandler.RowCount];

    return Number(count);
  }

  public async values(): Promise<StoredValue[]> {
    const { disableSerialization } = this.options;
    const rows = (await this.connection!.query(`
      SELECT \`value\`
      FROM \`${this.options.tableName}\`
    `)) as Omit<QueryHandler.RowData, 'key' | 'version'>[];

    return rows.map((row) => (disableSerialization ? JSON.parse(row.value) : toRaw(JSON.parse(row.value))));
  }

  private ensureTable() {
    return this.connection!.query(`
      CREATE TABLE IF NOT EXISTS \`${this.options.tableName}\` (
        \`key\` VARCHAR(512) PRIMARY KEY,
        \`value\` TEXT NOT NULL,
        \`version\` VARCHAR(255) NOT NULL
      );
    `);
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

    version: string;
  }

  export interface RowCount {
    count: string;
  }
}
