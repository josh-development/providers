import type { JoshProvider, Semver } from '@joshdb/provider';
import { version } from './helpers';

export default class DbHandler<StoredValue = unknown> {
  private idb: IDBFactory;
  private db!: IDBDatabase;

  public constructor() {
    if (!globalThis.indexedDB) {
      throw new Error("Your browser doesn't support a stable version of IndexedDB. Josh is unable to run without one.");
    }

    this.idb = globalThis.indexedDB;
  }

  public init(context: JoshProvider.Context) {
    const { name } = context;
    const request = this.idb.open(`joshdb-${name}`, 1);

    return new Promise<void>((resolve, reject) => {
      request.onerror = reject;

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store', { keyPath: 'key' });
        }
      };

      request.onsuccess = async () => {
        this.db = request.result;

        const storedVersion = (await this.getMetadata('version')) as Semver | undefined;

        if (!storedVersion) {
          await this.setMetadata('version', version);
        }

        resolve();
      };
    });
  }

  public async set<Value = StoredValue>(key: string, value: Value) {
    const all = this.open();
    const doc = {
      key,
      value
    };

    const request = all.put(doc);

    await this.handleEvents(request);
  }

  public async get<Value = StoredValue>(key: string): Promise<Value | undefined> {
    const all = this.open();
    const request = all.get(key);
    const result = (await this.handleEvents(request)) as {
      value: Value | undefined; // Its shit like this why I don't like TS
    };

    return result?.value;
  }

  public async getAll<Value = StoredValue>(): Promise<{ [key: string]: Value }> {
    const all = this.open();
    const request = all.getAll();
    const docs = (await this.handleEvents(request)) as { key: string; value: Value }[];
    const final: { [key: string]: Value } = {}; // Why can't this be inferred from usage????

    docs.forEach((x) => {
      final[x.key] = x.value;
    });

    return final;
  }

  public async getKeys(): Promise<string[]> {
    const all = this.open();
    const request = all.getAllKeys();

    return (await this.handleEvents(request)) as string[];
  }

  public async count() {
    const all = this.open();
    const request = all.count();
    const data = await this.handleEvents(request);

    if (typeof data !== 'number') throw new Error('Something is amiss!!!');

    return data;
  }

  public async delete(key: string) {
    const all = this.open();
    const request = all.delete(key);

    return this.handleEvents(request);
  }

  public async clear() {
    const all = this.open();
    const request = all.clear();

    return this.handleEvents(request);
  }

  public async has(key: string) {
    return (await this.get(key)) !== undefined;
  }

  public async getMetadata(key: string): Promise<unknown | undefined> {
    const all = this.openMetadata();
    const request = all.get(key);
    const result = (await this.handleEvents(request)) as {
      value: unknown | undefined; // Its shit like this why I don't like TS
    };

    return result?.value;
  }

  public async setMetadata(key: string, value: unknown) {
    const all = this.openMetadata();
    const doc = {
      key,
      value
    };

    const request = all.put(doc);

    await this.handleEvents(request);
  }

  public async deleteMetadata(key: string) {
    const all = this.openMetadata();
    const request = all.delete(key);

    return this.handleEvents(request);
  }

  public async clearMetadata() {
    const all = this.openMetadata();
    const request = all.clear();

    return this.handleEvents(request);
  }

  private handleEvents(request: IDBRequest) {
    return new Promise((res, rej) => {
      request.onsuccess = () => {
        res(request.result);
      };

      request.onerror = () => {
        rej(new Error(request.error?.toString()));
      };
    });
  }

  private open() {
    const transaction = this.db.transaction('store', 'readwrite');
    const all = transaction.objectStore('store');

    return all;
  }

  private openMetadata() {
    const transaction = this.db.transaction('meta', 'readwrite');
    const all = transaction.objectStore('meta');

    return all;
  }
}
