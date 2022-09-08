import { SerializeJSON, toJSON, toRaw } from '@joshdb/serialize';
import { writeFile } from 'node:fs/promises';
import { File } from '../File';
import { ChunkLockFile } from './ChunkLockFile';

export class ChunkFile<StoredValue = unknown> extends File<StoredValue> {
  public declare options: ChunkFile.Options & File.Options;

  public lock: ChunkLockFile;

  public constructor(options: ChunkFile.Options) {
    super({ ...options, name: `${options.id}.json` });

    this.lock = new ChunkLockFile(options);
  }

  public async fetch(): Promise<File.Data<StoredValue>> {
    if (!this.exists) return {};

    await this.copy(this.lock.path);

    const data = await this.lock.read<File.Data<StoredValue>>();

    await this.lock.delete();

    const { serialize } = this.options;

    return (serialize ? toRaw(data as unknown as SerializeJSON) : data) as File.Data<StoredValue>;
  }

  public async save(data: File.Data<StoredValue>): Promise<void> {
    const { serialize } = this.options;

    if (serialize) await this.attempt(() => writeFile(this.lock.path, JSON.stringify(toJSON(data))));
    else await this.lock.write(data);

    await this.lock.rename(this.path);
  }
}
export namespace ChunkFile {
  export interface Options {
    directory: string;

    id: string;

    serialize: boolean;

    retry?: File.RetryOptions;
  }
}
