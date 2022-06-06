import type { JoshProvider } from '@joshdb/provider';
import { AsyncQueue } from '@sapphire/async-queue';
import { Snowflake, TwitterSnowflake } from '@sapphire/snowflake';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ChunkFile } from './chunk-files/ChunkFile';
import { ChunkIndexFile } from './chunk-files/ChunkIndexFile';
import type { File } from './File';

export class ChunkHandler<StoredValue = unknown> {
  public options: ChunkHandlerOptions;

  public snowflake: Snowflake | typeof TwitterSnowflake;

  public directory: string;

  public queue = new AsyncQueue();

  public index: ChunkIndexFile;

  public files: Record<string, ChunkFile<StoredValue>> = {};

  public constructor(options: ChunkHandlerOptions) {
    const { name, version, dataDirectoryName, epoch, retry } = options;

    this.options = options;
    this.snowflake = epoch === undefined ? TwitterSnowflake : new Snowflake(epoch);
    this.directory = resolve(process.cwd(), dataDirectoryName ?? 'data', name);
    this.index = new ChunkIndexFile({ version, directory: this.directory, retry });
  }

  public async init(): Promise<this> {
    await this.queue.wait();

    await mkdir(this.directory, { recursive: true });

    this.queue.shift();

    const { name, version, synchronize } = this.options;

    if (!this.index.exists) await this.index.save({ name, version, autoKeyCount: 0, chunks: [] });
    if (synchronize) await this.synchronize();

    return this;
  }

  public async synchronize(): Promise<void> {
    const [index, done] = await this.useQueue();
    const { maxChunkSize } = this.options;
    const chunks = [];

    for (const chunk of index.chunks) {
      const file = this.getChunkFile(chunk.id);
      const data = await file.fetch();

      if (data === undefined) continue;

      let keys = Object.keys(data);

      if (chunk.keys.length > maxChunkSize) chunk.keys = keys.slice(0, maxChunkSize);
      if (keys.length > maxChunkSize) {
        for (let i = maxChunkSize + 1; i > 0; i--) {
          Reflect.deleteProperty(data, keys[i]);
          keys = keys.filter((_, index) => index !== i);
        }

        await file.save(data);
      }

      for (const key of keys) if (!chunk.keys.includes(key)) keys.push(key);
      for (const key of chunk.keys) if (!keys.includes(key)) chunk.keys = chunk.keys.filter((k) => k !== key);

      chunks.push(chunk);
    }

    await this.index.save({ name: index.name, version: index.version, autoKeyCount: index.autoKeyCount, chunks });
    done();
  }

  public async clear(): Promise<void> {
    const [index, done] = await this.useQueue();
    const chunks = index.chunks.reduce<string[]>((chunks, chunk) => [...chunks, chunk.id], []);

    for (const chunkId of chunks) {
      const file = this.getChunkFile(chunkId);

      if (file.exists) await file.delete();

      Reflect.deleteProperty(this.files, chunkId);
    }

    index.chunks = [];
    index.autoKeyCount = 0;
    await this.index.save(index);
    done();
  }

  public async delete(key: string): Promise<boolean> {
    const chunkId = await this.locateChunkId(key);

    if (chunkId === undefined) return false;

    const file = this.getChunkFile(chunkId);
    const [index, done] = await this.useQueue();
    const data = (await file.fetch()) ?? {};

    Reflect.deleteProperty(data, key);
    await file.save(data);

    for (const chunk of index.chunks) if (chunk.keys.some((k) => k === key)) chunk.keys = chunk.keys.filter((k) => k !== key);

    await this.index.save(index);
    done();
    await this.cleanupEmptyChunks();

    return true;
  }

  public async deleteMany(keys: string[]): Promise<void> {
    const index = await this.fetchIndex();

    for (const chunk of index.chunks.filter((chunk) => chunk.keys.some((k) => keys.includes(k)))) {
      await this.queue.wait();

      const file = this.getChunkFile(chunk.id);
      const data = (await file.fetch()) ?? {};

      for (const key of keys.filter((key) => chunk.keys.includes(key))) {
        Reflect.deleteProperty(data, key);
        chunk.keys = chunk.keys.filter((k) => k !== key);
      }

      keys = keys.filter((key) => !chunk.keys.includes(key));
      await file.save(data);
      await this.index.save(index);
      this.queue.shift();
      await this.cleanupEmptyChunks();
    }
  }

  public async entries(): Promise<[string, StoredValue][]> {
    const [index, done] = await this.useQueue();
    const entries = [];

    for (const chunk of index.chunks) {
      const file = this.getChunkFile(chunk.id);
      const data = await file.fetch();

      if (data === undefined) continue;

      entries.push(...Object.entries(data));
    }

    done();

    return entries;
  }

  public async has(key: string): Promise<boolean> {
    const index = await this.fetchIndex();

    for (const chunk of index.chunks) if (chunk.keys.some((k) => k === key)) return true;

    return false;
  }

  public async keys(): Promise<string[]> {
    const index = await this.fetchIndex();

    return index.chunks.reduce<string[]>((keys, chunk) => [...keys, ...chunk.keys], []);
  }

  public async get(key: string): Promise<StoredValue | undefined> {
    const chunkId = await this.locateChunkId(key);

    if (chunkId === undefined) return;

    await this.queue.wait();

    const file = this.getChunkFile(chunkId);
    const data = await file.fetch();

    if (data === undefined) return;

    this.queue.shift();

    if (!(key in data)) return;

    return data[key];
  }

  public async getMany(keys: string[]): Promise<Record<string, StoredValue | null>> {
    const [index, done] = await this.useQueue();
    const entries: Record<string, StoredValue | null> = {};

    for (const chunk of index.chunks) {
      if (chunk.keys.some((k) => keys.includes(k))) {
        const file = this.getChunkFile(chunk.id);
        const data = (await file.fetch()) ?? {};

        for (const [key, value] of Object.entries(data)) if (keys.includes(key)) entries[key] = value;
      }
    }

    done();

    for (const key of keys) if (!(key in entries)) entries[key] = null;

    return entries;
  }

  public async set<Value = StoredValue>(key: string, value: Value): Promise<void> {
    const { maxChunkSize } = this.options;
    const chunkId = await this.locateChunkId(key);
    const [index, done] = await this.useQueue();
    const chunk = index.chunks.find((chunk) => chunk.keys.length < maxChunkSize);

    if (chunkId !== undefined) {
      const file = this.getChunkFile(chunkId);
      const data = (await file.fetch()) ?? {};

      Reflect.set(data, key, value);
      await file.save(data);
    } else if (chunk === undefined) {
      const chunkId = this.snowflake.generate().toString();

      index.chunks.push({ keys: [key], id: chunkId });
      await this.index.save(index);
      // @ts-expect-error 2345
      await this.getChunkFile(chunkId).save({ [key]: value });
    } else {
      for (const c of index.chunks) if (c.id === chunk.id) c.keys.push(key);

      await this.index.save(index);

      const file = this.getChunkFile(chunk.id);
      const data = (await file.fetch()) ?? {};

      Reflect.set(data, key, value);
      await file.save(data);
    }

    done();
  }

  public async setMany(entries: [string, StoredValue][], overwrite: boolean): Promise<void> {
    const [index, done] = await this.useQueue();
    const { maxChunkSize } = this.options;

    for (const chunk of index.chunks) {
      const file = this.getChunkFile(chunk.id);
      const data = (await file.fetch()) ?? {};

      for (const [key, value] of entries) if (overwrite || !(key in data)) data[key] = value;

      entries = entries.filter(([key]) => !chunk.keys.includes(key));

      if (Object.keys(data).length < maxChunkSize) {
        for (const [key, value] of entries) {
          if (Object.keys(data).length >= maxChunkSize) break;

          data[key] = value;
          entries = entries.filter(([k]) => k !== key);
        }
      }
    }

    if (entries.length > 0) {
      const chunks = [];

      while (entries.length > 0) chunks.push(entries.splice(0, maxChunkSize));

      for (const chunk of chunks) {
        const chunkId = this.snowflake.generate().toString();

        index.chunks.push({ keys: chunk.map(([key]) => key), id: chunkId });
        await this.index.save(index);

        const file = this.getChunkFile(chunkId);

        await file.save(chunk.reduce<Record<string, StoredValue>>((data, [key, value]) => ({ ...data, [key]: value }), {}));
      }
    }

    done();
  }

  public async size(): Promise<number> {
    const index = await this.fetchIndex();

    return index.chunks.reduce((size, chunk) => size + chunk.keys.length, 0);
  }

  public async values(): Promise<StoredValue[]> {
    const [index, done] = await this.useQueue();
    const values = [];

    for (const chunk of index.chunks) {
      const file = this.getChunkFile(chunk.id);
      const data = await file.fetch();

      if (data === undefined) continue;

      values.push(...Object.values(data));
    }

    done();

    return values;
  }

  private async fetchIndex(): Promise<ChunkIndexFile.Data> {
    await this.queue.wait();

    const index = await this.index.fetch();

    this.queue.shift();

    return index;
  }

  private async useQueue(): Promise<ChunkHandlerUseQueueOptions> {
    await this.queue.wait();

    return [await this.index.fetch(), () => this.queue.shift()];
  }

  private async locateChunkId(key: string): Promise<string | undefined> {
    const index = await this.fetchIndex();

    for (const chunk of index.chunks) if (chunk.keys.some((k) => k === key)) return chunk.id;

    return undefined;
  }

  private async cleanupEmptyChunks(): Promise<void> {
    await this.queue.wait();

    const index = await this.index.fetch();

    for (const chunk of index.chunks.filter((chunk) => !chunk.keys.length)) {
      const file = this.getChunkFile(chunk.id);

      if (file.exists) await file.delete();

      Reflect.deleteProperty(this.files, chunk.id);
    }

    this.queue.shift();
  }

  private getChunkFile(chunkId: string): ChunkFile<StoredValue> {
    const { serialize, retry } = this.options;

    return this.files[chunkId] ?? (this.files[chunkId] = new ChunkFile({ directory: this.directory, id: chunkId, serialize, retry }));
  }
}

export interface ChunkHandlerOptions {
  name: string;

  version: JoshProvider.Semver;

  dataDirectoryName?: string;

  maxChunkSize: number;

  epoch?: number | bigint | Date;

  synchronize?: boolean;

  serialize: boolean;

  retry?: File.RetryOptions;
}

type ChunkHandlerUseQueueOptions = [ChunkIndexFile.Data, () => void];
