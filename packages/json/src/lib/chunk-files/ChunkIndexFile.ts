import type { Semver } from '@joshdb/provider';
import { mkdir } from 'node:fs/promises';
import { File } from '../File';
import { ChunkLockFile } from './ChunkLockFile';

export class ChunkIndexFile extends File {
  public version: Semver;

  public lock: ChunkLockFile;

  public constructor(options: ChunkIndexFile.Options) {
    const { version, directory, retry } = options;

    super({ directory, name: 'index.json', retry });
    this.version = version;
    this.lock = new ChunkLockFile({ directory, id: 'index', retry });
  }

  public async fetch(): Promise<ChunkIndexFile.Data> {
    if (!this.exists) {
      const { directory } = this.options;

      await mkdir(directory, { recursive: true });

      await this.save({ name: this.options.name, version: this.version, autoKeyCount: 0, chunks: [], metadata: {} });

      return this.fetch();
    }

    await this.copy(this.lock.path);

    const data = await this.lock.read<ChunkIndexFile.Data>();

    await this.lock.delete();

    return data;
  }

  public async save(data: ChunkIndexFile.Data): Promise<void> {
    await this.lock.write(data);
    await this.lock.rename(this.path);
  }
}

export namespace ChunkIndexFile {
  export interface Options {
    version: Semver;

    directory: string;

    retry?: File.RetryOptions;
  }

  export interface Data {
    name: string;

    version: Semver;

    autoKeyCount: number;

    chunks: Chunk[];

    metadata: Record<string, unknown>;
  }

  export interface Chunk {
    keys: string[];

    id: string;

    serialized: boolean;
  }

  export interface LegacyData {
    files: LegacyFileData[];
  }

  export interface LegacyFileData {
    keys: string[];

    location: string;
  }
}
