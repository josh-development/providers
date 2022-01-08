import type { StringArray } from '@joshdb/core';
import { File } from '../File';
import { ChunkLockFile } from './ChunkLockFile';

export class ChunkIndexFile extends File {
	public lock: ChunkLockFile;

	public constructor(options: ChunkIndexFile.Options) {
		const { directory, retry } = options;

		super({ directory, name: 'index.json', retry });

		this.lock = new ChunkLockFile({ directory, id: 'index', retry });
	}

	public async fetch(): Promise<ChunkIndexFile.Data> {
		if (!this.exists) {
			await this.save({ name: this.options.name, autoKeyCount: 0, chunks: [] });

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
		directory: string;

		retry?: File.RetryOptions;
	}

	export interface Data {
		chunks: Chunk[];

		autoKeyCount: number;

		name: string;
	}

	export interface Chunk {
		keys: StringArray;

		id: string;
	}
}
