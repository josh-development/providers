import { File } from '../File';

export class ChunkLockFile<StoredValue = unknown> extends File<StoredValue> {
  public constructor(options: ChunkLockFileOptions) {
    const { directory, id, retry } = options;

    super({ directory, name: `.temp-${id}.json.lock`, retry });
  }
}

export interface ChunkLockFileOptions {
  directory: string;

  id: string;

  retry?: File.RetryOptions;
}
