import { File } from '../File';

export class ChunkLockFile<StoredValue = unknown> extends File<StoredValue> {
  public constructor(options: ChunkLockFileOptions) {
    const { directory, id, serialize, retry } = options;

    super({ directory, name: `.temp-${id}.json.lock`, serialize, retry });
  }
}

export interface ChunkLockFileOptions {
  directory: string;

  id: string;

  serialize: boolean;

  retry?: File.RetryOptions;
}
