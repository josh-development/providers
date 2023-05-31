import { JoshProvider } from '@joshdb/provider';
import { runProviderTest } from '@joshdb/provider/tests';
import { mkdirSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ChunkFile, ChunkIndexFile, JSONProvider } from '../../src';

mkdirSync(resolve(process.cwd(), '.tests', 'migrations'), { recursive: true });

runProviderTest<typeof JSONProvider, JSONProvider.Options>({
  providerConstructor: JSONProvider,
  providerOptions: { dataDirectory: '.tests', disableSerialization: true }
});

describe('migrations', () => {
  describe('v1.0.0', () => {
    const directory = resolve(process.cwd(), '.tests', 'migrations');
    const entries = [
      { key: '1', value: '1' },
      { key: '2', value: '2' },
      { key: '3', value: '3' }
    ];

    beforeAll(async () => {
      await rm(directory, { recursive: true, force: true });
      await mkdir(directory, { recursive: true });

      await writeFile(resolve(directory, 'index.json'), JSON.stringify({ files: [{ location: '1', keys: ['1', '2', '3'] }] }));
      await writeFile(resolve(directory, '1.json'), JSON.stringify(entries));
    });

    test('GIVEN allowMigrations as false THEN throws', async () => {
      const provider = new JSONProvider({ dataDirectory: '.tests' });

      await expect(provider.init({ name: 'migrations' })).rejects.toThrowError(provider['error'](JoshProvider.CommonIdentifiers.NeedsMigration));
    });

    test('GIVEN allowMigrations as true THEN migrates', async () => {
      const provider = new JSONProvider({ dataDirectory: '.tests', allowMigrations: true });

      await provider.init({ name: 'migrations' });

      const index = new ChunkIndexFile({ directory, version: provider.version });
      const data = await index.fetch();

      expect(typeof data).toBe('object');

      const { name, version, autoKeyCount, chunks } = data;

      expect(name).toBe('migrations');
      expect(version).toStrictEqual(provider.version);
      expect(autoKeyCount).toBe(0);
      expect(chunks).toHaveLength(1);

      const [chunk] = chunks;
      const chunkFile = new ChunkFile({ directory, id: chunk.id, serialize: false });

      expect(chunkFile.exists).toBe(true);

      const chunkData = await chunkFile.read();

      expect(chunkData).toStrictEqual(entries);
    });
  });
});
