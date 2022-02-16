import { AsyncQueue } from '@sapphire/async-queue';
import { Snowflake, TwitterSnowflake } from '@sapphire/snowflake';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { resolve } from 'path';
import { ChunkFile } from './chunk-files/ChunkFile';
import { ChunkIndexFile } from './chunk-files/ChunkIndexFile';
import type { File } from './File';

export class ChunkHandler<StoredValue = unknown> {
  public options: ChunkHandler.Options;

  public snowflake: Snowflake | typeof TwitterSnowflake;

  public directory: string;

  public queue = new AsyncQueue();

  public index: ChunkIndexFile;

  public files: Record<string, ChunkFile<StoredValue>> = {};

  public constructor(options: ChunkHandler.Options) {
    const { name, dataDirectoryName, epoch, retry } = options;

    this.options = options;
    this.snowflake = epoch === undefined ? TwitterSnowflake : new Snowflake(epoch);
    this.directory = resolve(process.cwd(), dataDirectoryName ?? 'data', name);
    this.index = new ChunkIndexFile({ directory: this.directory, retry });
  }

  public async init(): Promise<this> {
    if (!existsSync(this.directory)) {
      await this.queue.wait();
      await mkdir(this.directory, { recursive: true });

      this.queue.shift();
    }

    const { name, synchronize } = this.options;

    if (!this.index.exists) await this.index.save({ name, autoKeyCount: 0, chunks: [] });
    if (synchronize) await this.synchronize();

    return this;
  }

  public async synchronize(): Promise<void> {
    await this.queue.wait();

    const index = await this.index.fetch();
    const { maxChunkSize, retry } = this.options;
    const chunks = [];

    for (const chunk of index.chunks) {
      const file = this.files[chunk.id] ?? (this.files[chunk.id] = new ChunkFile<StoredValue>({ directory: this.directory, id: chunk.id, retry }));

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

    await this.index.save({ name: index.name, autoKeyCount: index.autoKeyCount, chunks });

    this.queue.shift();
  }

  public async has(key: string): Promise<boolean> {
    await this.queue.wait();

    const index = await this.index.fetch();

    this.queue.shift();

    for (const chunk of index.chunks) if (chunk.keys.some((k) => k === key)) return true;

    return false;
  }

  public async get(key: string): Promise<StoredValue | undefined> {
    const chunkId = await this.locateChunkId(key);

    if (chunkId === undefined) return;

    await this.queue.wait();

    const { retry } = this.options;
    const file = this.files[chunkId] ?? (this.files[chunkId] = new ChunkFile({ directory: this.directory, id: chunkId, retry }));
    const data = await file.fetch();

    if (data === undefined) return;

    this.queue.shift();

    if (!(key in data)) return;

    return data[key];
  }

  public async set<Value = StoredValue>(key: string, value: Value): Promise<void> {
    await this.queue.wait();

    const index = await this.index.fetch();

    this.queue.shift();

    const { maxChunkSize, retry } = this.options;
    const chunkId = await this.locateChunkId(key);
    const chunk = index.chunks.find((chunk) => chunk.keys.length < maxChunkSize);

    await this.queue.wait();

    if (chunkId !== undefined) {
      const file = this.files[chunkId] ?? (this.files[chunkId] = new ChunkFile({ directory: this.directory, id: chunkId, retry }));

      const data = (await file.fetch()) ?? {};

      Reflect.set(data, key, value);

      await file.save(data);
    } else if (chunk === undefined) {
      const chunkId = this.snowflake.generate().toString();

      index.chunks.push({ keys: [key], id: chunkId });

      await this.index.save(index);
      // @ts-expect-error 2345
      await (this.files[chunkId] = new ChunkFile({ directory: this.directory, id: chunkId, retry })).save({ [key]: value });
    } else {
      for (const c of index.chunks) if (c.id === chunk.id) c.keys.push(key);

      await this.index.save(index);

      const file = this.getChunkFile(chunk.id);
      const data = (await file.fetch()) ?? {};

      Reflect.set(data, key, value);

      await file.save(data);
    }

    this.queue.shift();
  }

  public async setMany(entries: [string, StoredValue][], overwrite: boolean): Promise<void> {
    await this.queue.wait();

    const index = await this.index.fetch();

    this.queue.shift();

    const { maxChunkSize } = this.options;

    for (const chunk of index.chunks) {
      const file = this.getChunkFile(chunk.id);
      const data = (await file.fetch()) ?? {};

      for (const [key, value] of entries) if (overwrite || !(key in data)) data[key] = value;

      entries = entries.filter(([key]) => !chunk.keys.includes(key));

      if (Object.keys(data).length < maxChunkSize)
        for (const [key, value] of entries) {
          if (Object.keys(data).length >= maxChunkSize) break;

          data[key] = value;

          entries = entries.filter(([k]) => k !== key);
        }
    }

    if (entries.length > 0) {
      await this.queue.wait();

      const chunks = [];

      while (entries.length > 0) chunks.push(entries.splice(0, maxChunkSize));

      for (const chunk of chunks) {
        const chunkId = this.snowflake.generate().toString();

        index.chunks.push({ keys: chunk.map(([key]) => key), id: chunkId });

        await this.index.save(index);

        const file = this.getChunkFile(chunkId);

        await file.save(chunk.reduce<Record<string, StoredValue>>((data, [key, value]) => ({ ...data, [key]: value }), {}));
      }

      this.queue.shift();
    }
  }

  public async delete(key: string): Promise<boolean> {
    const chunkId = await this.locateChunkId(key);

    if (chunkId === undefined) return false;

    const { retry } = this.options;
    const file = this.files[chunkId] ?? (this.files[chunkId] = new ChunkFile({ directory: this.directory, id: chunkId, retry }));

    await this.queue.wait();

    const data = (await file.fetch()) ?? {};

    Reflect.deleteProperty(data, key);

    await file.save(data);

    const index = await this.index.fetch();

    for (const chunk of index.chunks) if (chunk.keys.some((k) => k === key)) chunk.keys = chunk.keys.filter((k) => k !== key);

    await this.index.save(index);

    this.queue.shift();

    await this.cleanupEmptyChunks();

    return true;
  }

  public async deleteMany(keys: string[]): Promise<void> {
    await this.queue.wait();

    const index = await this.index.fetch();

    this.queue.shift();

    for (const chunk of index.chunks) {
      const file = this.getChunkFile(chunk.id);
      const data = (await file.fetch()) ?? {};

      for (const key of keys.filter((key) => chunk.keys.includes(key))) {
        Reflect.deleteProperty(data, key);

        chunk.keys = chunk.keys.filter((k) => k !== key);
      }

      keys = keys.filter((key) => !chunk.keys.includes(key));

      await file.save(data);

      await this.queue.wait();

      await this.index.save(index);

      this.queue.shift();

      await this.cleanupEmptyChunks();
    }
  }

  public async clear(): Promise<void> {
    await this.queue.wait();

    const index = await this.index.fetch();
    const chunks = index.chunks.reduce<string[]>((chunks, chunk) => [...chunks, chunk.id], []);
    const { retry } = this.options;

    for (const chunkId of chunks) {
      const file = this.files[chunkId] ?? (this.files[chunkId] = new ChunkFile({ directory: this.directory, id: chunkId, retry }));

      if (file.exists) await file.delete();

      Reflect.deleteProperty(this.files, chunkId);
    }

    index.chunks = [];
    index.autoKeyCount = 0;

    await this.index.save(index);

    this.queue.shift();
  }

  public async size(): Promise<number> {
    await this.queue.wait();

    const index = await this.index.fetch();

    this.queue.shift();

    return index.chunks.reduce((size, chunk) => size + chunk.keys.length, 0);
  }

  public async values(): Promise<StoredValue[]> {
    await this.queue.wait();

    const index = await this.index.fetch();
    const values = [];

    for (const chunk of index.chunks) {
      const file = this.getChunkFile(chunk.id);
      const data = await file.fetch();

      if (data === undefined) continue;

      values.push(...Object.values(data));
    }

    this.queue.shift();

    return values;
  }

  public async entries(): Promise<[string, StoredValue][]> {
    await this.queue.wait();

    const index = await this.index.fetch();
    const entries = [];

    for (const chunk of index.chunks) {
      const file = this.getChunkFile(chunk.id);
      const data = await file.fetch();

      if (data === undefined) continue;

      entries.push(...Object.entries(data));
    }

    this.queue.shift();

    return entries;
  }

  public async keys(): Promise<string[]> {
    await this.queue.wait();

    const index = await this.index.fetch();

    this.queue.shift();

    return index.chunks.reduce<string[]>((keys, chunk) => [...keys, ...chunk.keys], []);
  }

  private async locateChunkId(key: string): Promise<string | undefined> {
    await this.queue.wait();

    const index = await this.index.fetch();

    this.queue.shift();

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
    const { retry } = this.options;

    return this.files[chunkId] ?? (this.files[chunkId] = new ChunkFile({ directory: this.directory, id: chunkId, retry }));
  }
}

export namespace ChunkHandler {
  export interface Options {
    name: string;

    dataDirectoryName?: string;

    maxChunkSize: number;

    epoch?: number | bigint | Date;

    synchronize?: boolean;

    retry?: File.RetryOptions;
  }
}
