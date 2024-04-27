import { Method } from '@joshdb/provider';
import { Db, MongoClient } from 'mongodb';
import { runProviderTest } from 'tests';
import { MongoProvider } from '../../src';

describe('Additional tests', () => {
  describe('various errors', () => {
    test('GIVEN uninitialized provider THEN should accessing client throw an error', async () => {
      const provider = new MongoProvider();

      await expect(provider.close()).rejects.toThrowError();
    });

    test('GIVEN uninitialized provider THEN should accessing collection throw an error', async () => {
      const provider = new MongoProvider();

      await expect(provider[Method.Get]({ method: Method.Get, key: 'key', path: [], errors: [] })).rejects.toThrowError();
    });
  });

  describe('migrations', () => {
    let client: MongoClient;
    let db: Db;

    beforeAll(async () => {
      client = new MongoClient('mongodb://localhost:27017/josh');

      await client.connect();

      db = client.db();

      const collection = db.collection('tests');

      await collection.insertOne({ key: 'key', value: 'value' });
      try {
        await db.dropCollection('metadata');
      } catch {}
    });

    test('should require allowMigrations', async () => {
      const provider = new MongoProvider({ collectionName: 'tests' });

      await expect(provider.init({ name: 'tests' })).rejects.toThrowError();
    });

    test('should migrate data from v1 to v2', async () => {
      const provider = new MongoProvider({ collectionName: 'tests', allowMigrations: true });

      await provider.init({ name: 'tests' });

      const { data } = await provider[Method.Get]({ method: Method.Get, key: 'key', path: [], errors: [] });

      expect(data).toBe('value');
    });

    afterAll(async () => {
      await db.dropDatabase();
      await client.close();
    });
  });
});

runProviderTest<typeof MongoProvider, MongoProvider.Options, MongoProvider>({
  providerConstructor: MongoProvider,
  cleanup: (provider) => provider.close(),
  providerOptions: { collectionName: 'tests' }
});
