import {
  isEveryByHookPayload,
  isEveryByValuePayload,
  isFilterByHookPayload,
  isFilterByValuePayload,
  isFindByHookPayload,
  isFindByValuePayload,
  isMapByHookPayload,
  isMapByPathPayload,
  isPartitionByHookPayload,
  isPartitionByValuePayload,
  isRemoveByHookPayload,
  isRemoveByValuePayload,
  isSomeByHookPayload,
  isSomeByValuePayload,
  JoshError,
  JoshProvider,
  MathOperator,
  Method,
  Payloads
} from '@joshdb/core';
import { deleteFromObject, getFromObject, hasFromObject, setToObject } from '@realware/utilities';
import { isNumber, isPrimitive } from '@sapphire/utilities';
import { ChunkHandler } from './ChunkHandler';
import type { File } from './File';

export class JSONProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: JSONProvider.Options;

  private _handler?: ChunkHandler<StoredValue>;

  public constructor(options: JSONProvider.Options) {
    super(options);
  }

  public async init(context: JoshProvider.Context<StoredValue>): Promise<JoshProvider.Context<StoredValue>> {
    context = await super.init(context);

    const { dataDirectoryName, maxChunkSize, epoch, synchronize, disableSerialization, retry } = this.options;

    this._handler = await new ChunkHandler<StoredValue>({
      name: context.name,
      version: context.version ?? null,
      dataDirectoryName,
      maxChunkSize: maxChunkSize ?? 100,
      epoch,
      synchronize,
      serialize: disableSerialization ? false : true,
      retry
    }).init();

    return context;
  }

  public async [Method.AutoKey](payload: Payloads.AutoKey): Promise<Payloads.AutoKey> {
    await this.handler.queue.wait();

    const index = await this.handler.index.fetch();

    index.autoKeyCount++;

    await this.handler.index.save(index);

    this.handler.queue.shift();

    payload.data = index.autoKeyCount.toString();

    return payload;
  }

  public async [Method.Clear](payload: Payloads.Clear): Promise<Payloads.Clear> {
    await this.handler.clear();

    return payload;
  }

  public async [Method.Dec](payload: Payloads.Dec): Promise<Payloads.Dec> {
    const { key, path } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = this.error({
        identifier: JSONProvider.CommonIdentifiers.DecMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')} does not exist.`,
        method: Method.Dec
      });

      return payload;
    }

    if (typeof data !== 'number') {
      payload.error = this.error({
        identifier: JSONProvider.CommonIdentifiers.DecInvalidType,
        message:
          path.length === 0 ? `The data at "${key}" must be of type "number"` : `The data at "${key}.${path.join('.')}" must be of type "number".`,
        method: Method.Dec
      });

      return payload;
    }

    await this.set({ method: Method.Set, key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payloads.Delete): Promise<Payloads.Delete> {
    const { key, path } = payload;

    if (path.length === 0) {
      await this.handler.delete(key);

      return payload;
    }

    if ((await this.has({ method: Method.Has, key, path, data: false })).data) {
      const { data } = await this.get({ method: Method.Get, key, path: [] });

      deleteFromObject(data, path);
      await this.handler.set(key, data);

      return payload;
    }

    return payload;
  }

  public async [Method.DeleteMany](payload: Payloads.DeleteMany): Promise<Payloads.DeleteMany> {
    const { keys } = payload;

    await this.handler.deleteMany(keys);

    return payload;
  }

  public async [Method.Ensure](payload: Payloads.Ensure<StoredValue>): Promise<Payloads.Ensure<StoredValue>> {
    const { key } = payload;

    if (!(await this.handler.has(key))) await this.handler.set(key, payload.defaultValue);

    Reflect.set(payload, 'data', await this.handler.get(key));

    return payload;
  }

  public async [Method.Every](payload: Payloads.Every.ByHook<StoredValue>): Promise<Payloads.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  public async [Method.Every](payload: Payloads.Every<StoredValue>): Promise<Payloads.Every<StoredValue>> {
    if ((await this.handler.size()) === 0) {
      payload.data = true;

      return payload;
    }

    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of await this.handler.values()) {
        const everyValue = await hook(value);

        if (everyValue) continue;

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;

      for (const storedValue of await this.handler.values()) {
        if (payload.path.length === 0) {
          if (!isPrimitive(storedValue)) {
            payload.error = this.error({
              identifier: JSONProvider.CommonIdentifiers.EveryInvalidType,
              message: 'The "value" must be of type primitive.',
              method: Method.Every
            });

            return payload;
          }

          if (storedValue === value) continue;
        } else if (getFromObject(storedValue, path) === value) continue;

        payload.data = false;
      }
    }

    return payload;
  }

  public async [Method.Filter](payload: Payloads.Filter.ByHook<StoredValue>): Promise<Payloads.Filter.ByHook<StoredValue>>;
  public async [Method.Filter](payload: Payloads.Filter.ByValue<StoredValue>): Promise<Payloads.Filter.ByValue<StoredValue>>;
  public async [Method.Filter](payload: Payloads.Filter<StoredValue>): Promise<Payloads.Filter<StoredValue>> {
    payload.data = {};

    if (isFilterByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of await this.handler.entries()) {
        const filterValue = await hook(value);

        if (!filterValue) continue;

        payload.data[key] = value;
      }
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = this.error({
          identifier: JSONProvider.CommonIdentifiers.FilterInvalidValue,
          message: 'The "value" must be of type primitive.',
          method: Method.Filter
        });

        return payload;
      }

      for (const [key, storedValue] of await this.handler.entries())
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data[key] = storedValue;
    }

    return payload;
  }

  public async [Method.Find](payload: Payloads.Find.ByHook<StoredValue>): Promise<Payloads.Find.ByHook<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find.ByValue<StoredValue>): Promise<Payloads.Find.ByValue<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find<StoredValue>): Promise<Payloads.Find<StoredValue>> {
    if (isFindByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of await this.handler.entries()) {
        const foundValue = await hook(value[1]);

        if (!foundValue) continue;

        payload.data = value;

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = this.error({
          identifier: JSONProvider.CommonIdentifiers.FindInvalidValue,
          message: 'The "value" must be of type primitive.',
          method: Method.Find
        });

        return payload;
      }

      for (const [key, storedValue] of await this.handler.entries()) {
        if (payload.data !== undefined) break;
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data = [key, storedValue];
      }
    }

    return payload;
  }

  public async [Method.Get]<Value = StoredValue>(payload: Payloads.Get<Value>): Promise<Payloads.Get<Value>> {
    const { key, path } = payload;
    const value = await this.handler.get(key);

    Reflect.set(payload, 'data', path.length === 0 ? value : getFromObject(value, path));

    return payload;
  }

  public async [Method.GetAll](payload: Payloads.GetAll<StoredValue>): Promise<Payloads.GetAll<StoredValue>> {
    payload.data = {};

    for (const [key, value] of await this.handler.entries()) payload.data[key] = value;

    return payload;
  }

  public async [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Promise<Payloads.GetMany<StoredValue>> {
    const { keys } = payload;

    payload.data = await this.handler.getMany(keys);

    return payload;
  }

  public async [Method.Has](payload: Payloads.Has): Promise<Payloads.Has> {
    const { key, path } = payload;

    if (await this.handler.has(key)) {
      payload.data = true;

      if (path.length !== 0) payload.data = hasFromObject(await this.handler.get(key), path);
    }

    return payload;
  }

  public async [Method.Inc](payload: Payloads.Inc): Promise<Payloads.Inc> {
    const { key, path } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = this.error({
        identifier: JSONProvider.CommonIdentifiers.IncMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data "${key}.${path.join('.')}" does not exist.`,
        method: Method.Inc
      });

      return payload;
    }

    if (typeof data !== 'number') {
      payload.error = this.error({
        identifier: JSONProvider.CommonIdentifiers.IncInvalidType,
        message:
          path.length === 0 ? `The data at "${key}" must be of type "number".` : `The data at "${key}.${path.join('.')}" must be of type "number".`,
        method: Method.Inc
      });

      return payload;
    }

    await this.set({ method: Method.Set, key, path, value: data + 1 });

    return payload;
  }

  public async [Method.Keys](payload: Payloads.Keys): Promise<Payloads.Keys> {
    payload.data = await this.handler.keys();

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByHook<StoredValue, Value>): Promise<Payloads.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByPath<Value>): Promise<Payloads.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map<StoredValue, Value>): Promise<Payloads.Map<StoredValue, Value>> {
    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      // @ts-expect-error 2345
      for (const value of await this.handler.values()) payload.data.push(await hook(value));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      // @ts-expect-error 2345
      for (const value of await this.handler.values()) payload.data.push(path.length === 0 ? value : getFromObject(value, path));
    }

    return payload;
  }

  public async [Method.Math](payload: Payloads.Math): Promise<Payloads.Math> {
    const { key, path, operator, operand } = payload;
    let { data } = await this.get<number>({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = this.error({
        identifier: JSONProvider.CommonIdentifiers.MathMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Math
      });

      return payload;
    }

    if (!isNumber(data)) {
      payload.error = this.error({
        identifier: JSONProvider.CommonIdentifiers.MathInvalidType,
        message: path.length === 0 ? `The data at "${key}" must be a number.` : `The data at "${key}.${path.join('.')}" must be a number.`,
        method: Method.Math
      });

      return payload;
    }

    switch (operator) {
      case MathOperator.Addition:
        data += operand;

        break;

      case MathOperator.Subtraction:
        data -= operand;

        break;

      case MathOperator.Multiplication:
        data *= operand;

        break;

      case MathOperator.Division:
        data /= operand;

        break;

      case MathOperator.Remainder:
        data %= operand;

        break;

      case MathOperator.Exponent:
        data **= operand;

        break;
    }

    await this.set({ method: Method.Set, key, path, value: data });

    return payload;
  }

  public async [Method.Partition](payload: Payloads.Partition.ByHook<StoredValue>): Promise<Payloads.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition.ByValue<StoredValue>): Promise<Payloads.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition<StoredValue>): Promise<Payloads.Partition<StoredValue>> {
    payload.data = { truthy: {}, falsy: {} };

    if (isPartitionByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of await this.handler.entries()) {
        const filterValue = await hook(value);

        if (filterValue) payload.data.truthy[key] = value;
        else payload.data.falsy[key] = value;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = this.error({
          identifier: JSONProvider.CommonIdentifiers.PartitionInvalidValue,
          message: 'The "value" must be a primitive type.',
          method: Method.Partition
        });

        return payload;
      }

      for (const [key, storedValue] of await this.handler.entries())
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data.truthy[key] = storedValue;
        else payload.data.falsy[key] = storedValue;
    }

    return payload;
  }

  public async [Method.Push]<Value = StoredValue>(payload: Payloads.Push<Value>): Promise<Payloads.Push<Value>> {
    const { key, path, value } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = this.error({
        identifier: JSONProvider.CommonIdentifiers.PushMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')} does not exist.`,
        method: Method.Push
      });

      return payload;
    }

    if (!Array.isArray(data)) {
      payload.error = this.error({
        identifier: JSONProvider.CommonIdentifiers.PushInvalidType,
        message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" must be an array.`,
        method: Method.Push
      });

      return payload;
    }

    data.push(value);

    await this.set({ method: Method.Set, key, path, value: data });

    return payload;
  }

  public async [Method.Random](payload: Payloads.Random<StoredValue>): Promise<Payloads.Random<StoredValue>> {
    const { count, duplicates } = payload;
    const size = await this.handler.size();

    if (size === 0) return payload;
    if (size < count) {
      payload.error = this.error({
        identifier: JoshProvider.CommonIdentifiers.RandomInvalidCount,
        message: `The count of values to be selected must be less than or equal to the number of values in the map.`,
        method: Method.Random
      });

      return payload;
    }

    payload.data = [];

    if (duplicates) {
      const keys = await this.handler.keys();

      payload.data.push((await this.handler.get(keys[Math.floor(Math.random() * keys.length)]))!);
    } else {
      const data: [string, StoredValue][] = [];

      for (let i = 0; i < count; i++) data.push(await this.randomEntriesWithDuplicates(data));

      payload.data = data.map(([, value]) => value);
    }

    return payload;
  }

  public async [Method.RandomKey](payload: Payloads.RandomKey): Promise<Payloads.RandomKey> {
    const { count, duplicates } = payload;
    const size = await this.handler.size();

    if (size === 0) return payload;
    if (size < count) {
      payload.error = this.error({
        identifier: JoshProvider.CommonIdentifiers.RandomKeyInvalidCount,
        message: `The count of keys to be selected must be less than or equal to the number of keys in the map.`,
        method: Method.RandomKey
      });

      return payload;
    }

    payload.data = [];

    const keys = await this.handler.keys();

    for (let i = 0; i < count; i++)
      payload.data.push(duplicates ? keys[Math.floor(Math.random() * keys.length)] : await this.randomKeyWithoutDuplicates(payload.data));

    return payload;
  }

  public async [Method.Remove]<Value = StoredValue>(payload: Payloads.Remove.ByHook<Value>): Promise<Payloads.Remove.ByHook<Value>>;
  public async [Method.Remove](payload: Payloads.Remove.ByValue): Promise<Payloads.Remove.ByValue>;
  public async [Method.Remove]<Value = StoredValue>(payload: Payloads.Remove<Value>): Promise<Payloads.Remove<Value>> {
    if (isRemoveByHookPayload(payload)) {
      const { key, path, hook } = payload;
      const { data } = await this.get<unknown[]>({ method: Method.Get, key, path });

      if (data === undefined) {
        payload.error = this.error({
          identifier: JSONProvider.CommonIdentifiers.RemoveMissingData,
          message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
          method: Method.Remove
        });

        return payload;
      }

      if (!Array.isArray(data)) {
        payload.error = this.error({
          identifier: JSONProvider.CommonIdentifiers.RemoveInvalidType,
          message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" must be an array.`,
          method: Method.Remove
        });

        return payload;
      }

      const filterValues = await Promise.all(data.map(hook));

      await this.set({ method: Method.Set, key, path, value: data.filter((_, index) => !filterValues[index]) });
    }

    if (isRemoveByValuePayload(payload)) {
      const { key, path, value } = payload;
      const { data } = await this.get({ method: Method.Get, key, path });

      if (data === undefined) {
        payload.error = this.error({
          identifier: JSONProvider.CommonIdentifiers.RemoveMissingData,
          message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
          method: Method.Remove
        });

        return payload;
      }

      if (!Array.isArray(data)) {
        payload.error = this.error({
          identifier: JSONProvider.CommonIdentifiers.RemoveInvalidType,
          message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" must be an array.`,
          method: Method.Remove
        });

        return payload;
      }

      await this.set({ method: Method.Set, key, path, value: data.filter((storedValue) => value !== storedValue) });
    }

    return payload;
  }

  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
    const { key, path, value } = payload;

    if (path.length === 0) await this.handler.set<Value>(key, value);
    else {
      const storedValue = await this.handler.get(key);

      await this.handler.set(key, setToObject(storedValue, path, value));
    }

    return payload;
  }

  public async [Method.SetMany]<Value = StoredValue>(payload: Payloads.SetMany<Value>): Promise<Payloads.SetMany<Value>> {
    const { entries, overwrite } = payload;

    const withPath = entries.filter(([{ path }]) => path.length > 0);
    const withoutPath = entries.filter(([{ path }]) => path.length === 0);

    for (const [{ key, path }, value] of withPath)
      if (overwrite || !(await this.handler.has(key))) await this.set<Value>({ method: Method.Set, key, path, value });

    if (withoutPath.length > 0)
      await this.handler.setMany(
        withoutPath.map(([{ key }, value]) => [key, value] as unknown as [string, StoredValue]),
        overwrite
      );

    return payload;
  }

  public async [Method.Size](payload: Payloads.Size): Promise<Payloads.Size> {
    payload.data = await this.handler.size();

    return payload;
  }

  public async [Method.Some](payload: Payloads.Some.ByHook<StoredValue>): Promise<Payloads.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payloads.Some.ByValue): Promise<Payloads.Some.ByValue>;
  public async [Method.Some](payload: Payloads.Some<StoredValue>): Promise<Payloads.Some<StoredValue>> {
    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of await this.handler.values()) {
        const someValue = await hook(value);

        if (!someValue) continue;

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for (const storedValue of await this.handler.values()) {
        if (path.length !== 0 && value !== getFromObject(storedValue, path)) continue;
        if (isPrimitive(storedValue) && value === storedValue) continue;

        payload.data = true;
      }
    }

    return payload;
  }

  public async [Method.Update]<Value = StoredValue>(payload: Payloads.Update<StoredValue, Value>): Promise<Payloads.Update<StoredValue, Value>> {
    const { key, path, hook } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) return payload;

    await this.set({ method: Method.Set, key, path, value: await hook(data) });

    return payload;
  }

  public async [Method.Values](payload: Payloads.Values<StoredValue>): Promise<Payloads.Values<StoredValue>> {
    payload.data = await this.handler.values();

    return payload;
  }

  private async randomEntriesWithDuplicates(data: [string, StoredValue][]): Promise<[string, StoredValue]> {
    const entries = await this.handler.entries();
    const entry = entries[Math.floor(Math.random() * entries.length)];

    if (data.length === 0) return entry;
    if (isPrimitive(entry[1]) && data.some(([key, value]) => entry[0] === key && entry[1] === value)) return this.randomEntriesWithDuplicates(data);

    return entry;
  }

  private async randomKeyWithoutDuplicates(data: string[]): Promise<string> {
    const keys = await this.handler.keys();
    const key = keys[Math.floor(Math.random() * keys.length)];

    if (data.length === 0) return key;
    if (data.includes(key)) return this.randomKeyWithoutDuplicates(data);

    return key;
  }

  private get handler(): ChunkHandler<StoredValue> {
    if (this._handler === undefined)
      throw new JoshError({
        identifier: JSONProvider.Identifiers.ChunkHandlerNotFound,
        message: 'The "ChunkHandler" was not found for this provider. This usually means the "init()" method was not invoked.'
      });

    return this._handler;
  }
}

export namespace JSONProvider {
  export interface Options extends JoshProvider.Options {
    dataDirectoryName?: string;

    maxChunkSize?: number;

    epoch?: number | bigint | Date;

    synchronize?: boolean;

    disableSerialization?: boolean;

    retry?: File.RetryOptions;
  }

  export enum Identifiers {
    ChunkHandlerNotFound = 'chunkHandlerNotFound'
  }
}
