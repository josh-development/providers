import { File } from '../File';

export class ChunkLockFile<StoredValue = unknown> extends File<StoredValue> {
  public constructor(options: ChunkLockFile.Options) {
    const { directory, id, retry } = options;

    super({ directory, name: `.temp-${id}.json.lock`, retry });
  }
}

export namespace ChunkLockFile {
  export interface Options {
    directory: string;

    id: string;

    retry?: File.RetryOptions;
  }
}
