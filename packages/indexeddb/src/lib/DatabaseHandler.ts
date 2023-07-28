import type { Semver } from '@joshdb/provider';

export class DatabaseHandler<StoredValue = unknown> {
  private options: DatabaseHandler.Options;

  private factory = globalThis.indexedDB;

  private _database?: IDBDatabase;

  public constructor(options: DatabaseHandler.Options) {
    this.options = options;
  }

  private get database(): IDBDatabase {
    if (this._database instanceof IDBDatabase) return this._database;

    throw new Error('Database not initialized. This is probably because init() was not called.');
  }

  public async init(): Promise<void> {
    const { name, version } = this.options;
    const request = this.factory.open(name, 1);

    await new Promise<void>((resolve, reject) => {
      request.onerror = reject;

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains('metadata')) {
          database.createObjectStore('metadata', { keyPath: 'key' });
        }

        if (!database.objectStoreNames.contains('entries')) {
          database.createObjectStore('entries', { keyPath: 'key' });
        }
      };

      request.onsuccess = async () => {
        this._database = request.result;

        const storedVersion = await this.getMetadata<Semver>('version');

        if (!storedVersion) {
          await this.setMetadata('version', version);
        }

        const autoKey = await this.getMetadata<number>('autoKey');

        if (typeof autoKey !== 'number') {
          await this.setMetadata('autoKey', 0);
        }

        resolve();
      };
    });
  }

  public async getMetadata<T>(key: string): Promise<T | undefined> {
    const metadataStore = this.openMetadata();
    const request = metadataStore.get(key);

    const row = await this.handleRequest<Partial<DatabaseHandler.Row<T>>>(request);

    return row?.value;
  }

  public async setMetadata(key: string, value: unknown): Promise<void> {
    const metadataStore = this.openMetadata();
    const request = metadataStore.put({ key, value });

    await this.handleRequest(request);
  }

  public async deleteMetadata(key: string): Promise<void> {
    const metadataStore = this.openMetadata();
    const request = metadataStore.delete(key);

    await this.handleRequest(request);
  }

  public async clear(): Promise<void> {
    const entriesStore = this.openEntries();

    await this.handleRequest(entriesStore.clear());

    const metadataStore = this.openMetadata();

    await this.handleRequest(metadataStore.clear());
    await this.setMetadata('autoKey', 0);

    const { version } = this.options;

    await this.setMetadata('version', version);
  }

  public async delete(key: string): Promise<boolean> {
    const exists = await this.has(key);

    if (!exists) return false;

    const entriesStore = this.openEntries();
    const request = entriesStore.delete(key);

    await this.handleRequest(request);

    return true;
  }

  public async deleteMany(keys: string[]): Promise<void> {
    const entriesStore = this.openEntries();
    const requests = keys.map((key) => entriesStore.delete(key));

    for (const request of requests) {
      await this.handleRequest(request);
    }
  }

  public async entries(): Promise<[string, StoredValue][]> {
    const entriesStore = this.openEntries();
    const request = entriesStore.getAll();
    const data = await this.handleRequest<DatabaseHandler.Row<StoredValue>[]>(request);
    const entries = data.map(({ key, value }) => [key, value] as [string, StoredValue]);

    return entries;
  }

  public async get<Value = StoredValue>(key: string): Promise<Value | undefined> {
    const entriesStore = this.openEntries();
    const request = entriesStore.get(key);
    const row = await this.handleRequest<Partial<DatabaseHandler.Row<Value>>>(request);

    return row?.value;
  }

  public async getMany(keys: string[]): Promise<Record<string, StoredValue | null>> {
    const entriesStore = this.openEntries();
    const entries: Record<string, StoredValue | null> = {};

    for (const key of keys) {
      const request = entriesStore.get(key);
      const row = await this.handleRequest<Partial<DatabaseHandler.Row<StoredValue>>>(request);

      entries[key] = row?.value ?? null;
    }

    return entries;
  }

  public async has(key: string): Promise<boolean> {
    const cursorRequest = this.openEntries().openKeyCursor();

    return new Promise((resolve, reject) => {
      cursorRequest.onsuccess = (event) => {
        const target = event.target as IDBRequest;
        const cursor = target.result;

        if (cursor) {
          console.log(cursor.key, key);

          if (cursor.key === key) {
            return resolve(true);
          }

          cursor.continue();
        } else {
          resolve(false);
        }
      };

      cursorRequest.onerror = () => {
        reject(cursorRequest.error);
      };
    });
  }

  public async keys(): Promise<string[]> {
    const entriesStore = this.openEntries();
    const request = entriesStore.getAllKeys();

    return this.handleRequest(request);
  }

  public async set<Value = StoredValue>(key: string, value: Value): Promise<void> {
    const entriesStore = this.openEntries();
    const request = entriesStore.put({ key, value });

    await this.handleRequest(request);
  }

  public async setMany(entries: [string, StoredValue][], overwrite: boolean): Promise<void> {
    const entriesStore = this.openEntries();

    for (const [key, value] of entries) {
      if (!overwrite) {
        const request = entriesStore.add({ key, value });

        await this.handleRequest(request);
      } else {
        const request = entriesStore.put({ key, value });

        await this.handleRequest(request);
      }
    }
  }

  public async size(): Promise<number> {
    const entriesStore = this.openEntries();
    const request = entriesStore.count();

    return this.handleRequest(request);
  }

  public async values(): Promise<StoredValue[]> {
    const cursorRequest = this.openEntries().openCursor();
    const values: StoredValue[] = [];

    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;

        if (!cursor) {
          return resolve();
        }

        const { value } = cursor.value as DatabaseHandler.Row<StoredValue>;

        values.push(value);

        cursor.continue();
      };

      cursorRequest.onerror = () => {
        reject(cursorRequest.error);
      };
    });

    return values;
  }

  private async handleRequest<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private openEntries() {
    const transaction = this.database.transaction('entries', 'readwrite');

    return transaction.objectStore('entries');
  }

  private openMetadata() {
    const transaction = this.database.transaction('metadata', 'readwrite');

    return transaction.objectStore('metadata');
  }
}

export namespace DatabaseHandler {
  export interface Options {
    name: string;

    version: Semver;
  }

  export interface Row<T> {
    key: string;

    value: T;
  }
}
