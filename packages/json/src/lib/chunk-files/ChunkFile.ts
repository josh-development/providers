import { File } from '../File';
import { ChunkLockFile } from './ChunkLockFile';

export class ChunkFile<StoredValue = unknown> extends File<StoredValue> {
  public lock: ChunkLockFile;

  public constructor(options: ChunkFileOptions) {
    const { directory, id, serialize, retry } = options;

    super({ directory, name: `${id}.json`, serialize, retry });

    this.lock = new ChunkLockFile(options);
  }

  public async fetch(): Promise<File.Data<StoredValue>> {
    if (!this.exists) return {};

    await this.copy(this.lock.path);

    const data = await this.lock.read<File.Data<StoredValue>>();

    await this.lock.delete();

    return data ?? {};
  }

  public async save(data: File.Data<StoredValue>): Promise<void> {
    await this.lock.write(data);
    await this.lock.rename(this.path);
  }
}

export interface ChunkFileOptions {
  directory: string;

  id: string;

  serialize: boolean;

  retry?: File.RetryOptions;
}
