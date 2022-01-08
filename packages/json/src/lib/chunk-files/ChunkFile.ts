import { File } from '../File';
import { ChunkLockFile } from './ChunkLockFile';

export class ChunkFile<StoredValue = unknown> extends File<StoredValue> {
	public lock: ChunkLockFile;

	public constructor(options: ChunkFile.Options) {
		const { directory, id, retry } = options;

		super({ directory, name: `${id}.json`, retry });

		this.lock = new ChunkLockFile(options);
	}

	public async fetch(): Promise<File.Data<StoredValue> | undefined> {
		if (!this.exists) return undefined;

		await this.copy(this.lock.path);

		const data = await this.lock.read<File.Data<StoredValue>>();

		await this.lock.delete();

		return data;
	}

	public async save(data: File.Data<StoredValue>): Promise<void> {
		await this.lock.write(data);
		await this.lock.rename(this.path);
	}
}

export namespace ChunkFile {
	export interface Options {
		directory: string;

		id: string;

		retry?: File.RetryOptions;
	}
}
