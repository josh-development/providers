export default class DbHandler<StoredValue = unknown> {
  private idb: IDBFactory;
  private db!: IDBDatabase;

  public constructor() {
    if (!globalThis.indexedDB) {
      throw new Error("Your browser doesn't support a stable version of IndexedDB. Josh is unable to run without one.");
    }

    this.idb = globalThis.indexedDB;
  }

  public init() {
    const request = this.idb.open('josh');

    return new Promise<void>((resolve, reject) => {
      request.onerror = reject;

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
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
}
