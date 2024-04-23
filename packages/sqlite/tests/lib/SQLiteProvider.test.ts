import { JoshProvider } from '@joshdb/provider';
import Database from 'better-sqlite3';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runProviderTest } from 'tests';
import { QueryHandler, SQLiteProvider } from '../../src';

runProviderTest<typeof SQLiteProvider, Partial<SQLiteProvider.Options>>({
  providerConstructor: SQLiteProvider,
  providerOptions: {
    persistent: false
  },
  // @ts-expect-error 2322
  cleanup: (provider: SQLiteProvider) => {
    provider['handler'].database.close();
  }
});

describe('migrations', () => {
  describe('v1.0.0', () => {
    const dataDirectory = resolve(process.cwd(), '.tests');
    const entries = [
      { key: '1', value: '1' },
      { key: '2', value: '2' },
      { key: '3', value: '3' }
    ];

    beforeAll(async () => {
      await rm(resolve(dataDirectory, 'provider.sqlite'), { force: true });
      await mkdir(dataDirectory, { recursive: true });

      const database = new Database(resolve(dataDirectory, 'provider.sqlite'));

      database.prepare(`CREATE TABLE 'provider' (key TEXT, path TEXT, value TEXT, PRIMARY KEY (key, path))`).run();
      database.pragma('synchronous = 1');
      database.prepare(`CREATE TABLE 'internal::autonum' (josh TEXT PRIMARY KEY, lastnum INTEGER)`).run();
      database.prepare(`INSERT INTO 'internal::autonum' (josh, lastnum) VALUES (@josh, @lastnum)`).run({ josh: 'provider', lastnum: 10 });
      database
        .prepare(`INSERT INTO 'provider' (key, path, value) VALUES ${entries.map(() => '(?, ?, ?)').join(', ')}`)
        .run(...entries.flatMap((entry) => [entry.key, '::NULL::', entry.value]));
    });

    test('GIVEN allowMigrations as false THEN throws', async () => {
      const provider = new SQLiteProvider({ dataDirectory, persistent: true });

      await expect(provider.init({ name: 'provider' })).rejects.toThrowError(provider['error'](JoshProvider.CommonIdentifiers.NeedsMigration));
    });

    test('GIVEN allowMigrations as true THEN runs migration successfully', async () => {
      const provider = new SQLiteProvider({ dataDirectory, persistent: true, allowMigrations: true });

      await provider.init({ name: 'provider' });

      const metadataRow = provider['handler'].database
        .prepare<Pick<QueryHandler.MetadataRow, 'name'>>(`SELECT * FROM 'internal_metadata' WHERE name = @name`)
        .get({ name: 'provider' }) as QueryHandler.MetadataRow;

      expect(typeof metadataRow).toBe('object');

      const { name, version, autoKeyCount } = metadataRow;

      expect(name).toBe('provider');
      expect(version.startsWith('2.')).toBe(true);
      expect(autoKeyCount).toBe(10);

      const rows = provider['handler'].entries();

      expect(rows).toHaveLength(entries.length);
    });
  });
});
