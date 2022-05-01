import {
  CommonIdentifiers,
  deleteProperty,
  getProperty,
  hasProperty,
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
  isPayloadWithData,
  isRemoveByHookPayload,
  isRemoveByValuePayload,
  isSomeByHookPayload,
  isSomeByValuePayload,
  JoshProvider,
  MathOperator,
  Method,
  Payloads,
  PROPERTY_NOT_FOUND,
  resolveCommonIdentifier,
  setProperty
} from '@joshdb/core';
import { isPrimitive } from '@sapphire/utilities';
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

    const { dataDirectoryName, disableSerialization, epoch, maxChunkSize, retry, synchronize } = this.options;

    this._handler = await new ChunkHandler<StoredValue>({
      name: context.name,
      dataDirectoryName,
      serialize: disableSerialization ? false : true,
      epoch,
      maxChunkSize: maxChunkSize ?? 100,
      retry,
      synchronize
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
    const getPayload = await this[Method.Get]({ method: Method.Get, key, path });

    if (!isPayloadWithData(getPayload))
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Dec }, { key, path }) };

    const { data } = getPayload;

    if (typeof data !== 'number')
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Dec }, { key, path, type: 'number' }) };

    await this[Method.Set]({ method: Method.Set, key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payloads.Delete): Promise<Payloads.Delete> {
    const { key, path } = payload;

    if (path.length === 0) await this.handler.delete(key);
    else if ((await this[Method.Has]({ method: Method.Has, key, path })).data) {
      const { data } = await this[Method.Get]({ method: Method.Get, key, path: [] });

      deleteProperty(data, path);
      await this.handler.set(key, data);
    }

    return payload;
  }

  public async [Method.DeleteMany](payload: Payloads.DeleteMany): Promise<Payloads.DeleteMany> {
    const { keys } = payload;

    await this.handler.deleteMany(keys);

    return payload;
  }

  public async [Method.Each](payload: Payloads.Each<StoredValue>): Promise<Payloads.Each<StoredValue>> {
    const { hook } = payload;

    for (const key of await this.handler.keys()) await hook((await this.handler.get(key))!, key);

    return payload;
  }

  public async [Method.Ensure](payload: Payloads.Ensure<StoredValue>): Promise<Payloads.Ensure<StoredValue>> {
    const { key, defaultValue } = payload;

    payload.data = defaultValue;

    if ((await this[Method.Has]({ method: Method.Has, key, path: [] })).data) payload.data = await this.handler.get(key);
    else await this.handler.set(key, defaultValue);

    return payload;
  }

  public async [Method.Every](payload: Payloads.Every.ByHook<StoredValue>): Promise<Payloads.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  public async [Method.Every](payload: Payloads.Every<StoredValue>): Promise<Payloads.Every<StoredValue>> {
    payload.data = true;

    if ((await this.handler.size()) === 0) return payload;
    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of await this.handler.values()) {
        const result = await hook(value);

        if (result) continue;

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND)
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Every }, { key, path }) };
        if (!isPrimitive(data))
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Every }, { key, path, type: 'primitive' })
          };
        if (data === value) continue;

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

      for (const [key, value] of await this.handler.entries()) if (await hook(value)) payload.data[key] = value;
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND)
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Filter }, { key, path }) };
        if (!isPrimitive(data))
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Filter }, { key, path, type: 'primitive' })
          };
        if (data === value) payload.data[key] = storedValue;
      }
    }

    return payload;
  }

  public async [Method.Find](payload: Payloads.Find.ByHook<StoredValue>): Promise<Payloads.Find.ByHook<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find.ByValue<StoredValue>): Promise<Payloads.Find.ByValue<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find<StoredValue>): Promise<Payloads.Find<StoredValue>> {
    payload.data = [null, null];

    if (isFindByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of await this.handler.entries()) {
        const result = await hook(value);

        if (!result) continue;

        payload.data = [key, value];

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value))
        return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Find }, { path, type: 'primitive' }) };

      for (const [key, storedValue] of await this.handler.entries()) {
        if (payload.data[0] !== null && payload.data[1] !== null) break;

        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND)
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Find }, { key, path }) };
        if (!isPrimitive(data))
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Find }, { key, path, type: 'primitive' })
          };
        if (data !== value) continue;

        payload.data = [key, storedValue];

        break;
      }
    }

    return payload;
  }

  public async [Method.Get]<Value = StoredValue>(payload: Payloads.Get<Value>): Promise<Payloads.Get<Value>> {
    const { key, path } = payload;

    if (path.length === 0) {
      if (await this.handler.has(key)) payload.data = (await this.handler.get(key)) as unknown as Value;
    } else {
      const data = getProperty<Value>(await this.handler.get(key), path);

      if (data !== PROPERTY_NOT_FOUND) payload.data = data;
    }

    return payload;
  }

  public async [Method.GetAll](payload: Payloads.GetAll<StoredValue>): Promise<Payloads.GetAll<StoredValue>> {
    payload.data = (await this.handler.entries()).reduce((data, [key, value]) => ({ ...data, [key]: value }), {});

    return payload;
  }

  public async [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Promise<Payloads.GetMany<StoredValue>> {
    const { keys } = payload;

    payload.data = await this.handler.getMany(keys);

    return payload;
  }

  public async [Method.Has](payload: Payloads.Has): Promise<Payloads.Has> {
    payload.data = (await this.handler.has(payload.key)) && hasProperty(await this.handler.get(payload.key), payload.path);

    return payload;
  }

  public async [Method.Inc](payload: Payloads.Inc): Promise<Payloads.Inc> {
    const { key, path } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, key, path });

    if (!isPayloadWithData(getPayload))
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Inc }, { key, path }) };

    const { data } = getPayload;

    if (typeof data !== 'number')
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Inc }, { key, path, type: 'number' }) };

    await this[Method.Set]({ method: Method.Set, key, path, value: data + 1 });

    return payload;
  }

  public async [Method.Keys](payload: Payloads.Keys): Promise<Payloads.Keys> {
    payload.data = await this.handler.keys();

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByHook<StoredValue, Value>): Promise<Payloads.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByPath<Value>): Promise<Payloads.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map<StoredValue, Value>): Promise<Payloads.Map<StoredValue, Value>> {
    payload.data = [];

    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of await this.handler.values()) payload.data.push(await hook(value));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for (const value of await this.handler.values()) {
        const data = getProperty<Value>(value, path);

        if (data !== PROPERTY_NOT_FOUND) payload.data.push(data);
      }
    }

    return payload;
  }

  public async [Method.Math](payload: Payloads.Math): Promise<Payloads.Math> {
    const { key, path, operator, operand } = payload;
    const getPayload = await this[Method.Get]<number>({ method: Method.Get, key, path });

    if (!isPayloadWithData(getPayload))
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Math }, { key, path }) };

    let { data } = getPayload;

    if (typeof data !== 'number')
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Math }, { key, path, type: 'number' }) };

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

    await this[Method.Set]({ method: Method.Set, key, path, value: data });

    return payload;
  }

  public async [Method.Partition](payload: Payloads.Partition.ByHook<StoredValue>): Promise<Payloads.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition.ByValue<StoredValue>): Promise<Payloads.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition<StoredValue>): Promise<Payloads.Partition<StoredValue>> {
    payload.data = { truthy: {}, falsy: {} };

    if (isPartitionByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of await this.handler.entries()) {
        const result = await hook(value);

        payload.data[result ? 'truthy' : 'falsy'][key] = value;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
        const data = getProperty(storedValue, path);

        if (data === PROPERTY_NOT_FOUND)
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Partition }, { key, path }) };
        if (!isPrimitive(data))
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Partition }, { key, path, type: 'primitive' })
          };

        payload.data[data === value ? 'truthy' : 'falsy'][key] = storedValue;
      }
    }

    return payload;
  }

  public async [Method.Push]<Value = StoredValue>(payload: Payloads.Push<Value>): Promise<Payloads.Push<Value>> {
    const { key, path, value } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, key, path });

    if (!isPayloadWithData(getPayload))
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Push }, { key, path }) };

    const { data } = getPayload;

    if (!Array.isArray(data))
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Push }, { key, path, type: 'array' }) };

    data.push(value);
    await this[Method.Set]({ method: Method.Set, key, path, value: data });

    return payload;
  }

  public async [Method.Random](payload: Payloads.Random<StoredValue>): Promise<Payloads.Random<StoredValue>> {
    const { count, duplicates } = payload;
    const size = await this.handler.size();

    if (size === 0) return payload;
    if (size < count) return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random }) };

    payload.data = [];

    const keys = await this.handler.keys();

    if (duplicates) {
      while (payload.data.length < count) {
        const key = keys[Math.floor(Math.random() * size)];

        payload.data.push((await this.handler.get(key))!);
      }
    } else {
      const randomKeys = new Set<string>();

      while (randomKeys.size < count) randomKeys.add(keys[Math.floor(Math.random() * keys.length)]);

      for (const key of randomKeys) payload.data.push((await this.handler.get(key))!);
    }

    return payload;
  }

  public async [Method.RandomKey](payload: Payloads.RandomKey): Promise<Payloads.RandomKey> {
    const { count, duplicates } = payload;
    const size = await this.handler.size();

    if (size === 0) return payload;
    if (size < count) return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.RandomKey }) };

    payload.data = [];

    const keys = await this.handler.keys();

    if (duplicates) {
      while (payload.data.length < count) payload.data.push(keys[Math.floor(Math.random() * size)]);
    } else {
      const randomKeys = new Set<string>();

      while (randomKeys.size < count) randomKeys.add(keys[Math.floor(Math.random() * keys.length)]);

      for (const key of randomKeys) payload.data.push(key);
    }

    return payload;
  }

  public async [Method.Remove]<Value = StoredValue>(payload: Payloads.Remove.ByHook<Value>): Promise<Payloads.Remove.ByHook<Value>>;
  public async [Method.Remove](payload: Payloads.Remove.ByValue): Promise<Payloads.Remove.ByValue>;
  public async [Method.Remove]<Value = StoredValue>(payload: Payloads.Remove<Value>): Promise<Payloads.Remove<Value>> {
    if (isRemoveByHookPayload(payload)) {
      const { key, path, hook } = payload;
      const getPayload = await this[Method.Get]<Value[]>({ method: Method.Get, key, path });

      if (!isPayloadWithData(getPayload))
        return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Remove }, { key, path }) };

      const { data } = getPayload;

      if (!Array.isArray(data))
        return {
          ...payload,
          error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Remove }, { key, path, type: 'array' })
        };

      const filterValues = await Promise.all(data.map(hook));

      await this[Method.Set]({ method: Method.Set, key, path, value: data.filter((_, index) => !filterValues[index]) });
    }

    if (isRemoveByValuePayload(payload)) {
      const { key, path, value } = payload;
      const getPayload = await this[Method.Get]({ method: Method.Get, key, path });

      if (!isPayloadWithData(getPayload))
        return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Remove }, { key, path }) };

      const { data } = getPayload;

      if (!Array.isArray(data))
        return {
          ...payload,
          error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Remove }, { key, path, type: 'array' })
        };

      await this[Method.Set]({ method: Method.Set, key, path, value: data.filter((storedValue) => storedValue !== value) });
    }

    return payload;
  }

  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
    const { key, path, value } = payload;

    if (path.length === 0) await this.handler.set(key, value as unknown as StoredValue);
    else {
      const storedValue = await this.handler.get(key);

      await this.handler.set(key, setProperty(storedValue, path, value));
    }

    return payload;
  }

  public async [Method.SetMany](payload: Payloads.SetMany): Promise<Payloads.SetMany> {
    const { entries, overwrite } = payload;
    const withPath = entries.filter(([{ path }]) => path.length > 0);
    const withoutPath = entries.filter(([{ path }]) => path.length === 0);

    for (const [{ key, path }, value] of withPath)
      if (overwrite) await this[Method.Set]({ method: Method.Set, key, path, value });
      else if (!(await this[Method.Has]({ method: Method.Has, key, path })).data) await this[Method.Set]({ method: Method.Set, key, path, value });

    if (withoutPath.length > 0)
      await this.handler.setMany(
        withoutPath.map(([{ key }, value]) => [key, value as unknown as StoredValue]),
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
    payload.data = false;

    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of await this.handler.values()) {
        const result = await hook(value);

        if (!result) continue;

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND)
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Some }, { key, path }) };
        if (!isPrimitive(data))
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Some }, { key, path, type: 'primitive' })
          };
        if (data !== value) continue;

        payload.data = true;

        break;
      }
    }

    return payload;
  }

  public async [Method.Update]<Value = StoredValue>(payload: Payloads.Update<StoredValue, Value>): Promise<Payloads.Update<StoredValue, Value>> {
    const { key, hook } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, key, path: [] });

    if (!isPayloadWithData<StoredValue>(getPayload))
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Update }, { key }) };

    const { data } = getPayload;

    await this[Method.Set]({ method: Method.Set, key, path: [], value: await hook(data) });

    return payload;
  }

  public async [Method.Values](payload: Payloads.Values<StoredValue>): Promise<Payloads.Values<StoredValue>> {
    payload.data = await this.handler.values();

    return payload;
  }

  protected resolveIdentifier(identifier: string, metadata: Record<string, unknown>): string {
    const result = resolveCommonIdentifier(identifier, metadata);

    if (result !== null) return result;

    switch (identifier) {
      case JSONProvider.Identifiers.ChunkHandlerNotFound:
        return 'The "ChunkHandler" was not found for this provider. This usually means the "init()" method was not invoked.';
    }

    throw new Error(`Unknown identifier: ${identifier}`);
  }

  private get handler(): ChunkHandler<StoredValue> {
    if (this._handler instanceof ChunkHandler) return this._handler;

    throw this.error(JSONProvider.Identifiers.ChunkHandlerNotFound);
  }

  public static version = '[VI]{version}[/VI]';
}

export namespace JSONProvider {
  export interface Options extends JoshProvider.Options {
    dataDirectoryName?: string;

    disableSerialization?: boolean;

    epoch?: number | bigint | Date;

    maxChunkSize?: number;

    retry?: File.RetryOptions;

    synchronize?: boolean;
  }

  export enum Identifiers {
    ChunkHandlerNotFound = 'chunkHandlerNotFound'
  }
}
