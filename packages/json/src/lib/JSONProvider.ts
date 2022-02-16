import {
  AutoKeyPayload,
  ClearPayload,
  DecPayload,
  DeleteManyPayload,
  DeletePayload,
  EnsurePayload,
  EveryByHookPayload,
  EveryByValuePayload,
  EveryPayload,
  FilterByHookPayload,
  FilterByValuePayload,
  FilterPayload,
  FindByHookPayload,
  FindByValuePayload,
  FindPayload,
  GetAllPayload,
  GetManyPayload,
  GetPayload,
  HasPayload,
  IncPayload,
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
  KeysPayload,
  MapByHookPayload,
  MapByPathPayload,
  MapPayload,
  MathOperator,
  MathPayload,
  Method,
  PartitionByHookPayload,
  PartitionByValuePayload,
  PartitionPayload,
  PushPayload,
  RandomKeyPayload,
  RandomPayload,
  RemoveByHookPayload,
  RemoveByValuePayload,
  RemovePayload,
  SetManyPayload,
  SetPayload,
  SizePayload,
  SomeByHookPayload,
  SomeByValuePayload,
  SomePayload,
  UpdatePayload,
  ValuesPayload
} from '@joshdb/core';
import { deleteFromObject, getFromObject, hasFromObject, setToObject } from '@realware/utilities';
import { isNumber, isPrimitive } from '@sapphire/utilities';
import { ChunkHandler } from './ChunkHandler';
import type { File } from './File';
import { JSONProviderError } from './JSONProviderError';

export class JSONProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: JSONProvider.Options;

  private _handler?: ChunkHandler<StoredValue>;

  public constructor(options: JSONProvider.Options) {
    super(options);
  }

  public async init(context: JoshProvider.Context<StoredValue>): Promise<JoshProvider.Context<StoredValue>> {
    context = await super.init(context);

    const { dataDirectoryName, maxChunkSize, epoch, synchronize, retry } = this.options;

    this._handler = await new ChunkHandler<StoredValue>({
      name: context.name,
      dataDirectoryName,
      maxChunkSize: maxChunkSize ?? 100,
      epoch,
      synchronize,
      retry
    }).init();

    return context;
  }

  public async [Method.AutoKey](payload: AutoKeyPayload): Promise<AutoKeyPayload> {
    await this.handler.queue.wait();

    const index = await this.handler.index.fetch();

    index.autoKeyCount++;

    await this.handler.index.save(index);

    this.handler.queue.shift();

    payload.data = index.autoKeyCount.toString();

    return payload;
  }

  public async [Method.Clear](payload: ClearPayload): Promise<ClearPayload> {
    await this.handler.clear();

    return payload;
  }

  public async [Method.Dec](payload: DecPayload): Promise<DecPayload> {
    const { key, path } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = new JSONProviderError({
        identifier: JSONProvider.CommonIdentifiers.DecMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')} does not exist.`,
        method: Method.Dec
      });

      return payload;
    }

    if (typeof data !== 'number') {
      payload.error = new JSONProviderError({
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

  public async [Method.Delete](payload: DeletePayload): Promise<DeletePayload> {
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

  public async [Method.DeleteMany](payload: DeleteManyPayload): Promise<DeleteManyPayload> {
    const { keys } = payload;

    await this.handler.deleteMany(keys);

    return payload;
  }

  public async [Method.Ensure](payload: EnsurePayload<StoredValue>): Promise<EnsurePayload<StoredValue>> {
    const { key } = payload;

    if (!(await this.handler.has(key))) await this.handler.set(key, payload.defaultValue);

    Reflect.set(payload, 'data', await this.handler.get(key));

    return payload;
  }

  public async [Method.Every](payload: EveryByHookPayload<StoredValue>): Promise<EveryByHookPayload<StoredValue>>;
  public async [Method.Every](payload: EveryByValuePayload): Promise<EveryByValuePayload>;
  public async [Method.Every](payload: EveryPayload<StoredValue>): Promise<EveryPayload<StoredValue>> {
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

      for (const key of (await this.keys({ method: Method.Keys, data: [] })).data) {
        const { data } = await this.get({ method: Method.Get, key, path });

        if (value === data) continue;

        payload.data = false;
      }
    }

    return payload;
  }

  public async [Method.Filter](payload: FilterByHookPayload<StoredValue>): Promise<FilterByHookPayload<StoredValue>>;
  public async [Method.Filter](payload: FilterByValuePayload<StoredValue>): Promise<FilterByValuePayload<StoredValue>>;
  public async [Method.Filter](payload: FilterPayload<StoredValue>): Promise<FilterPayload<StoredValue>> {
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
        payload.error = new JSONProviderError({
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

  public async [Method.Find](payload: FindByHookPayload<StoredValue>): Promise<FindByHookPayload<StoredValue>>;
  public async [Method.Find](payload: FindByValuePayload<StoredValue>): Promise<FindByValuePayload<StoredValue>>;
  public async [Method.Find](payload: FindPayload<StoredValue>): Promise<FindPayload<StoredValue>> {
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
        payload.error = new JSONProviderError({
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

  public async [Method.Get]<Value = StoredValue>(payload: GetPayload<Value>): Promise<GetPayload<Value>> {
    const { key, path } = payload;
    const value = await this.handler.get(key);

    Reflect.set(payload, 'data', path.length === 0 ? value : getFromObject(value, path));

    return payload;
  }

  public async [Method.GetAll](payload: GetAllPayload<StoredValue>): Promise<GetAllPayload<StoredValue>> {
    for (const [key, value] of await this.handler.entries()) payload.data[key] = value;

    return payload;
  }

  public async [Method.GetMany](payload: GetManyPayload<StoredValue>): Promise<GetManyPayload<StoredValue>> {
    const { keys } = payload;

    for (const key of keys) payload.data[key] = (await this.handler.get(key)) ?? null;

    return payload;
  }

  public async [Method.Has](payload: HasPayload): Promise<HasPayload> {
    const { key, path } = payload;

    if (await this.handler.has(key)) {
      payload.data = true;

      if (path.length !== 0) payload.data = hasFromObject(await this.handler.get(key), path);
    }

    return payload;
  }

  public async [Method.Inc](payload: IncPayload): Promise<IncPayload> {
    const { key, path } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = new JSONProviderError({
        identifier: JSONProvider.CommonIdentifiers.IncMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data "${key}.${path.join('.')}" does not exist.`,
        method: Method.Inc
      });

      return payload;
    }

    if (typeof data !== 'number') {
      payload.error = new JSONProviderError({
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

  public async [Method.Keys](payload: KeysPayload): Promise<KeysPayload> {
    payload.data = await this.handler.keys();

    return payload;
  }

  public async [Method.Map]<DataValue = StoredValue, HookValue = DataValue>(
    payload: MapByHookPayload<DataValue, HookValue>
  ): Promise<MapByHookPayload<DataValue, HookValue>>;

  public async [Method.Map]<DataValue = StoredValue>(payload: MapByPathPayload<DataValue>): Promise<MapByPathPayload<DataValue>>;
  public async [Method.Map]<DataValue = StoredValue, HookValue = DataValue>(
    payload: MapPayload<DataValue, HookValue>
  ): Promise<MapPayload<DataValue, HookValue>> {
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

  public async [Method.Math](payload: MathPayload): Promise<MathPayload> {
    const { key, path, operator, operand } = payload;
    let { data } = await this.get<number>({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = new JSONProviderError({
        identifier: JSONProvider.CommonIdentifiers.MathMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Math
      });

      return payload;
    }

    if (!isNumber(data)) {
      payload.error = new JSONProviderError({
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

  public async [Method.Partition](payload: PartitionByHookPayload<StoredValue>): Promise<PartitionByHookPayload<StoredValue>>;
  public async [Method.Partition](payload: PartitionByValuePayload<StoredValue>): Promise<PartitionByValuePayload<StoredValue>>;
  public async [Method.Partition](payload: PartitionPayload<StoredValue>): Promise<PartitionPayload<StoredValue>> {
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
        payload.error = new JSONProviderError({
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

  public async [Method.Push]<Value = StoredValue>(payload: PushPayload<Value>): Promise<PushPayload<Value>> {
    const { key, path, value } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = new JSONProviderError({
        identifier: JSONProvider.CommonIdentifiers.PushMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')} does not exist.`,
        method: Method.Push
      });

      return payload;
    }

    if (!Array.isArray(data)) {
      payload.error = new JSONProviderError({
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

  public async [Method.Random](payload: RandomPayload<StoredValue>): Promise<RandomPayload<StoredValue>> {
    const { count, duplicates } = payload;
    const size = await this.handler.size();

    if (size === 0) return payload;
    if (size < count) {
      payload.error = new JSONProviderError({
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

  public async [Method.RandomKey](payload: RandomKeyPayload): Promise<RandomKeyPayload> {
    const { count, duplicates } = payload;
    const size = await this.handler.size();

    if (size === 0) return payload;
    if (size < count) {
      payload.error = new JSONProviderError({
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

  public async [Method.Remove]<HookValue = StoredValue>(payload: RemoveByHookPayload<HookValue>): Promise<RemoveByHookPayload<HookValue>>;
  public async [Method.Remove](payload: RemoveByValuePayload): Promise<RemoveByValuePayload>;
  public async [Method.Remove]<HookValue = StoredValue>(payload: RemovePayload<HookValue>): Promise<RemovePayload<HookValue>> {
    if (isRemoveByHookPayload(payload)) {
      const { key, path, hook } = payload;
      const { data } = await this.get<unknown[]>({ method: Method.Get, key, path });

      if (data === undefined) {
        payload.error = new JSONProviderError({
          identifier: JSONProvider.CommonIdentifiers.RemoveMissingData,
          message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
          method: Method.Remove
        });

        return payload;
      }

      if (!Array.isArray(data)) {
        payload.error = new JSONProviderError({
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
        payload.error = new JSONProviderError({
          identifier: JSONProvider.CommonIdentifiers.RemoveMissingData,
          message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
          method: Method.Remove
        });

        return payload;
      }

      if (!Array.isArray(data)) {
        payload.error = new JSONProviderError({
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

  public async [Method.Set]<Value = StoredValue>(payload: SetPayload<Value>): Promise<SetPayload<Value>> {
    const { key, path, value } = payload;

    if (path.length === 0) await this.handler.set<Value>(key, value);
    else {
      const storedValue = await this.handler.get(key);

      await this.handler.set(key, setToObject(storedValue, path, value));
    }

    return payload;
  }

  public async [Method.SetMany]<Value = StoredValue>(payload: SetManyPayload<Value>): Promise<SetManyPayload<Value>> {
    const { data, overwrite } = payload;

    const withPath = data.filter(([{ path }]) => path.length > 0);
    const withoutPath = data.filter(([{ path }]) => path.length === 0);

    for (const [{ key, path }, value] of withPath)
      if (overwrite || !(await this.handler.has(key))) await this.set<Value>({ method: Method.Set, key, path, value });

    if (withoutPath.length > 0)
      await this.handler.setMany(
        withoutPath.map(([{ key }, value]) => [key, value] as unknown as [string, StoredValue]),
        overwrite
      );

    return payload;
  }

  public async [Method.Size](payload: SizePayload): Promise<SizePayload> {
    payload.data = await this.handler.size();

    return payload;
  }

  public async [Method.Some](payload: SomeByHookPayload<StoredValue>): Promise<SomeByHookPayload<StoredValue>>;
  public async [Method.Some](payload: SomeByValuePayload): Promise<SomeByValuePayload>;
  public async [Method.Some](payload: SomePayload<StoredValue>): Promise<SomePayload<StoredValue>> {
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

  public async [Method.Update]<HookValue = StoredValue, Value = HookValue>(
    payload: UpdatePayload<StoredValue, HookValue, Value>
  ): Promise<UpdatePayload<StoredValue, HookValue, Value>> {
    const { key, path, hook } = payload;
    const { data } = await this.get<HookValue>({ method: Method.Get, key, path });

    if (data === undefined) return payload;

    Reflect.set(payload, 'data', await hook(data));
    await this.set({ method: Method.Set, key, path, value: payload.data });

    return payload;
  }

  public async [Method.Values](payload: ValuesPayload<StoredValue>): Promise<ValuesPayload<StoredValue>> {
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

    retry?: File.RetryOptions;
  }

  export enum Identifiers {
    ChunkHandlerNotFound = 'chunkHandlerNotFound'
  }
}
