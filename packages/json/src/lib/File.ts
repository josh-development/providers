import { Serialize } from '@joshdb/serialize';
import type { Awaitable } from '@sapphire/utilities';
import { existsSync } from 'fs';
import { copyFile, readFile, rename, rm, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { setTimeout as wait } from 'timers/promises';

export class File<StoredValue = unknown> {
  public options: File.Options;

  public path: string;

  public constructor(options: File.Options) {
    this.options = options;

    const { directory, name } = options;

    this.path = resolve(directory, name);
  }

  public async read<Data = File.Data<StoredValue>>(): Promise<Data> {
    return this.attempt<Data>(async () =>
      this.options.serialize
        ? new Serialize({ json: JSON.parse(await readFile(this.path, { encoding: 'utf-8' })) }).toRaw<Data>()
        : JSON.parse(await readFile(this.path, { encoding: 'utf-8' }))
    );
  }

  public async write<Data = File.Data<StoredValue>>(data: Data): Promise<void> {
    await this.attempt(() => writeFile(this.path, JSON.stringify(this.options.serialize ? new Serialize({ raw: data }).toJSON() : data)));
  }

  public async copy(to: string): Promise<void> {
    await this.attempt(() => copyFile(this.path, to));
  }

  public async rename(to: string): Promise<void> {
    await this.attempt(() => rename(this.path, to));
  }

  public async delete(): Promise<void> {
    await this.attempt(() => rm(this.path));
  }

  protected async attempt<T = unknown>(callback: File.Callback<T>, retry = this.retryOptions): Promise<T> {
    try {
      return callback();
    } catch (error) {
      if (retry.attempts === 0) throw error;

      return wait(retry.delay, this.attempt(callback, { ...retry, attempts: retry.attempts - 1 }));
    }
  }

  public get retryOptions(): File.RetryOptions {
    return this.options.retry ?? File.defaultRetryOptions;
  }

  public get exists(): boolean {
    return existsSync(this.path);
  }

  public static defaultRetryOptions: File.RetryOptions = { delay: 100, attempts: 10 };
}

export namespace File {
  export interface Options {
    directory: string;

    name: string;

    serialize: boolean;

    retry?: RetryOptions;
  }

  export interface RetryOptions {
    delay: number;

    attempts: number;
  }

  export type Callback<T> = () => Awaitable<T>;

  export type Data<Value = unknown> = Record<string, Value>;
}
