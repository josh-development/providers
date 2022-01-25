export default class DbHandler {
  private idb: IDBFactory;
  private db!: IDBDatabase;

  public constructor() {
    if (!indexedDB) {
      throw new Error("Your browser doesn't support a stable version of IndexedDB. Josh is unable to run without one.");
    }

    this.idb = indexedDB;
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

  public async set(key: string, value: unknown) {
    const all = this.open();
    const doc = {
      key,
      value
    };

    const request = all.put(doc);

    await this.handleEvents(request);
  }

  public async get(key: string) {
    const all = this.open();
    const request = all.get(key);
    const result = await this.handleEvents(request);

    // @ts-ignore it exists f you TS
    return result?.value;
  }

  public async getAll() {
    const all = this.open();
    const request = all.getAll();
    const docs = await this.handleEvents(request);
    const final = {};

    // @ts-ignore TS GO AWAY
    docs.forEach((x) => {
      // @ts-ignore TS GO AWAY
      final[x.key] = x.value;
    });

    return final;
  }

  public async getKeys() {
    const all = this.open();
    const request = all.getAllKeys();

    return this.handleEvents(request);
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
