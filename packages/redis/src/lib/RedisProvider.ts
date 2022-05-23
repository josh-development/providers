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
  setProperty
} from '@joshdb/core';
import { Serialize } from '@joshdb/serialize';
import { isNullOrUndefined, isNumber, isPrimitive } from '@sapphire/utilities';
import { createClient, RedisClientOptions, RedisClientType } from 'redis';
import { v4 } from 'uuid';

export class RedisProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: RedisProvider.Options;
  private _client?: RedisClientType;

  public constructor(options?: RedisProvider.Options) {
    super(options);
  }

  public async init(context: JoshProvider.Context<StoredValue>): Promise<JoshProvider.Context<StoredValue>> {
    context = await super.init(context);
    this._client = createClient(this.options.connectOptions) as RedisClientType;
    await this._client.connect();
    return context;
  }

  public close() {
    return this.client.quit();
  }

  public [Method.AutoKey](payload: Payloads.AutoKey): Payloads.AutoKey {
    payload.data = v4();

    return payload;
  }

  public async [Method.Clear](payload: Payloads.Clear): Promise<Payloads.Clear> {
    await this.client.flushAll();
    return payload;
  }

  public async [Method.Dec](payload: Payloads.Dec): Promise<Payloads.Dec> {
    const { key, path } = payload;
    const getPayload = await this[Method.Get]<StoredValue>({ key, method: Method.Get, path });

    if (!isPayloadWithData(getPayload)) {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Dec }, { key, path }) };
    }

    const { data } = getPayload;

    if (!isNumber(data)) {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Dec }, { key, path, type: 'number' }) };
    }

    await this[Method.Set]({ method: Method.Set, key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payloads.Delete): Promise<Payloads.Delete> {
    const { key, path } = payload;
    if (path.length === 0) {
      await this.client.del(key);

      return payload;
    }

    if ((await this[Method.Has]({ method: Method.Has, key, path, data: false })).data) {
      const { data } = await this[Method.Get]({ method: Method.Get, key, path: [] });

      deleteProperty(data, path);
      await this[Method.Set]({ method: Method.Set, key, path: [], value: data });

      return payload;
    }

    return payload;
  }

  public async [Method.DeleteMany](payload: Payloads.DeleteMany): Promise<Payloads.DeleteMany> {
    const { keys } = payload;

    for (const key of keys) {
      await this.client.del(key);
    }

    return payload;
  }

  public async [Method.Each](payload: Payloads.Each<StoredValue>): Promise<Payloads.Each<StoredValue>> {
    const { hook } = payload;

    for await (const { key, value } of this._iterate()) {
      console.log(key, value);
      await hook(value, key);
    }

    return payload;
  }

  public async [Method.Ensure](payload: Payloads.Ensure<StoredValue>): Promise<Payloads.Ensure<StoredValue>> {
    const { key } = payload;

    if (!(await this[Method.Has]({ key, method: Method.Has, data: false, path: [] })).data) {
      await this[Method.Set]({ key, value: payload.defaultValue, method: Method.Set, path: [] });
    }

    payload.data = (await this[Method.Get]({ key, method: Method.Get, path: [] })).data as StoredValue;

    return payload;
  }

  public async [Method.Entries](payload: Payloads.Entries<StoredValue>): Promise<Payloads.Entries<StoredValue>> {
    payload.data = {};

    for await (const doc of this._iterate()) payload.data[doc.key] = doc.value;

    return payload;
  }

  public async [Method.Every](payload: Payloads.Every.ByHook<StoredValue>): Promise<Payloads.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  public async [Method.Every](payload: Payloads.Every<StoredValue>): Promise<Payloads.Every<StoredValue>> {
    payload.data = true;

    if ((await this[Method.Size]({ method: Method.Size })).data === 0) return payload;
    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { value } of this._iterate()) {
        const result = await hook(value);

        if (result) continue;

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;
      for await (const { key, value: storedValue } of this._iterate()) {
        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Every }, { key, path }) };
        }

        if (!isPrimitive(data)) {
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Every }, { key, path, type: 'primitive' })
          };
        }

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

      for await (const { key, value } of this._iterate()) {
        const filterValue = await hook(value);

        if (!filterValue) continue;

        payload.data[key] = value;
      }
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this._iterate()) {
        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Filter }, { key, path }) };
        }

        if (!isPrimitive(data)) {
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Filter }, { key, path, type: 'primitive' })
          };
        }

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

      for await (const { key, value } of this._iterate()) {
        const result = await hook(value);

        if (!result) continue;

        payload.data = [key, value];

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = this.error({ identifier: CommonIdentifiers.InvalidValueType, method: Method.Find }, { type: 'primitive' });

        return payload;
      }

      for await (const { key, value: storedValue } of this._iterate()) {
        if (payload.data[0] !== null && payload.data[1] !== null) break;

        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Find }, { key, path }) };
        }

        if (!isPrimitive(data)) {
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Find }, { key, path, type: 'primitive' })
          };
        }

        if (data !== value) continue;

        payload.data = [key, storedValue];

        break;
      }
    }

    return payload;
  }

  public async [Method.Get]<StoredValue>(payload: Payloads.Get<StoredValue>): Promise<Payloads.Get<StoredValue>> {
    const { key, path } = payload;
    const doc = (await this.client.get(key)) as unknown as RedisProvider.DocType<StoredValue>;

    if (!doc) {
      return payload;
    }

    if (path.length === 0) {
      payload.data = this.deserialize(doc as string) as unknown as StoredValue;
    } else {
      const data = getProperty<StoredValue>(this.deserialize(doc as string), path);

      if (data !== PROPERTY_NOT_FOUND) payload.data = data;
    }

    return payload;
  }

  public async [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Promise<Payloads.GetMany<StoredValue>> {
    payload.data = {};

    const { keys } = payload;
    for (const key of keys) {
      const value = (await this[Method.Get]<StoredValue>({ method: Method.Get, key, path: [] })).data;

      payload.data[key] = value || null;
    }

    return payload;
  }

  public async [Method.Has](payload: Payloads.Has): Promise<Payloads.Has> {
    const { key, path } = payload;
    let isThere = (await this.client.exists(key)) === 1;

    if (path.length !== 0 && isThere) {
      const value = await this[Method.Get]({ method: Method.Get, key, path: [] });

      isThere = hasProperty(value.data, path);
    }

    payload.data = isThere;

    return payload;
  }

  public async [Method.Inc](payload: Payloads.Inc): Promise<Payloads.Inc> {
    const { key, path } = payload;
    const getPayload = await this[Method.Get]<StoredValue>({ method: Method.Get, key, path });

    if (!isPayloadWithData(getPayload)) {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Inc }, { key, path }) };
    }

    const { data } = getPayload;

    if (typeof data !== 'number') {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Inc }, { key, path, type: 'number' }) };
    }

    await this[Method.Set]({ method: Method.Set, key, path, value: data + 1 });

    return payload;
  }

  public async [Method.Keys](payload: Payloads.Keys): Promise<Payloads.Keys> {
    payload.data = await this.client.keys('*');

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByHook<StoredValue, Value>): Promise<Payloads.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByPath<Value>): Promise<Payloads.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map<StoredValue, Value>): Promise<Payloads.Map<StoredValue, Value>> {
    payload.data = [];

    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { value } of this._iterate()) payload.data.push(await hook(value));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for await (const { value } of this._iterate()) {
        const data = getProperty<Value>(value, path);

        if (data !== PROPERTY_NOT_FOUND) payload.data.push(data);
      }
    }

    return payload;
  }

  public async [Method.Math](payload: Payloads.Math): Promise<Payloads.Math> {
    const { key, path, operator, operand } = payload;
    const getPayload = await this[Method.Get]<number>({ method: Method.Get, key, path });

    if (!isPayloadWithData(getPayload)) {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Math }, { key, path }) };
    }

    let { data } = getPayload;

    if (typeof data !== 'number') {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Math }, { key, path, type: 'number' }) };
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

    await this[Method.Set]({ method: Method.Set, key, path, value: data });

    return payload;
  }

  public async [Method.Partition](payload: Payloads.Partition.ByHook<StoredValue>): Promise<Payloads.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition.ByValue<StoredValue>): Promise<Payloads.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition<StoredValue>): Promise<Payloads.Partition<StoredValue>> {
    payload.data = { truthy: {}, falsy: {} };

    if (isPartitionByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { key, value } of this._iterate()) {
        const result = await hook(value);

        if (result) payload.data.truthy[key] = value;
        else payload.data.falsy[key] = value;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this._iterate()) {
        const data = getProperty<StoredValue>(storedValue, path);

        if (data === PROPERTY_NOT_FOUND) {
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Partition }, { key, path }) };
        }

        if (!isPrimitive(data)) {
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Partition }, { key, path, type: 'primitive' })
          };
        }

        if (value === data) payload.data.truthy[key] = storedValue;
        else payload.data.falsy[key] = storedValue;
      }
    }

    return payload;
  }

  public async [Method.Push]<Value = StoredValue>(payload: Payloads.Push<Value>): Promise<Payloads.Push<Value>> {
    const { key, path, value } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, key, path });

    if (!isPayloadWithData(getPayload)) {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Push }, { key, path }) };
    }

    const { data } = getPayload;

    if (!Array.isArray(data)) {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Push }, { key, path, type: 'array' }) };
    }

    data.push(value);
    await this[Method.Set]({ method: Method.Set, key, path, value: data });

    return payload;
  }

  // Due to the use of $sample, the output will never have duplicates
  public async [Method.Random](payload: Payloads.Random<StoredValue>): Promise<Payloads.Random<StoredValue>> {
    const docCount = (await this[Method.Size]({ method: Method.Size })).data || 0;

    if (docCount === 0) return payload;
    if (docCount < payload.count) {
      return {
        ...payload,
        error: this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random })
      };
    }

    const keys = await this[Method.Keys]({ method: Method.Keys, data: [] });

    keys.data = keys.data || [];
    payload.data = [];
    for (let i = 0; i < payload.count; i++) {
      const key = keys.data[Math.floor(Math.random() * keys.data.length)];
      const getPayload = await this[Method.Get]({ method: Method.Get, key, path: [] });

      payload.data.push(getPayload.data as StoredValue);
    }

    return payload;
  }

  public async [Method.RandomKey](payload: Payloads.RandomKey): Promise<Payloads.RandomKey> {
    const docCount = (await this[Method.Size]({ method: Method.Size })).data || 0;

    if (docCount === 0) return payload;
    if (docCount < payload.count) {
      return {
        ...payload,
        error: this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random })
      };
    }

    const keys = await this[Method.Keys]({ method: Method.Keys, data: [] });

    keys.data = keys.data || [];
    payload.data = [];
    for (let i = 0; i < payload.count; i++) {
      const key = keys.data[Math.floor(Math.random() * keys.data.length)];
      payload.data.push(key);
    }

    return payload;
  }

  public async [Method.Remove]<HookValue = StoredValue>(payload: Payloads.Remove.ByHook<HookValue>): Promise<Payloads.Remove.ByHook<HookValue>>;
  public async [Method.Remove](payload: Payloads.Remove.ByValue): Promise<Payloads.Remove.ByValue>;
  public async [Method.Remove]<HookValue = StoredValue>(payload: Payloads.Remove<HookValue>): Promise<Payloads.Remove<HookValue>> {
    if (isRemoveByHookPayload(payload)) {
      const { key, path, hook } = payload;
      const getPayload = await this[Method.Get]<HookValue[]>({ method: Method.Get, key, path });

      if (!isPayloadWithData(getPayload)) {
        return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Remove }, { key, path }) };
      }

      const { data } = getPayload;

      if (!Array.isArray(data)) {
        return {
          ...payload,
          error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Remove }, { key, path, type: 'array' })
        };
      }

      const filterValues = await Promise.all(data.map(hook));

      await this[Method.Set]({ method: Method.Set, key, path, value: data.filter((_, index) => !filterValues[index]) });
    }

    if (isRemoveByValuePayload(payload)) {
      const { key, path, value } = payload;
      const getPayload = await this[Method.Get]({ method: Method.Get, key, path });

      if (!isPayloadWithData(getPayload)) {
        return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Remove }, { key, path }) };
      }

      const { data } = getPayload;

      if (!Array.isArray(data)) {
        return {
          ...payload,
          error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Remove }, { key, path, type: 'array' })
        };
      }

      await this[Method.Set]({ method: Method.Set, key, path, value: data.filter((storedValue) => value !== storedValue) });
    }

    return payload;
  }

  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
    const { key, path, value } = payload;
    const val = path.length > 0 ? setProperty((await this[Method.Get]({ method: Method.Get, key, path })).data, path, value) : value;

    await this.client.set(key, this.serialize(val) as string, { EX: this.options.expiry });

    return payload;
  }

  public async [Method.SetMany](payload: Payloads.SetMany): Promise<Payloads.SetMany> {
    const { entries } = payload;
    const operations = [];

    for (const [{ key, path }, value] of entries) {
      if (!payload.overwrite) {
        const found = (await this[Method.Has]({ method: Method.Has, key, path, data: false })).data;

        if (found) continue;
      }

      const val = path.length > 0 ? setProperty((await this[Method.Get]({ method: Method.Get, key, path: [] })).data, path, value) : value;

      operations.push(this.client.set(key, this.serialize(val) as string, { EX: this.options.expiry }));
    }

    await Promise.all(operations);

    return payload;
  }

  public async [Method.Size](payload: Payloads.Size): Promise<Payloads.Size> {
    payload.data = (await this.client.dbSize()) ?? payload.data;

    return payload;
  }

  public async [Method.Some](payload: Payloads.Some.ByHook<StoredValue>): Promise<Payloads.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payloads.Some.ByValue): Promise<Payloads.Some.ByValue>;
  public async [Method.Some](payload: Payloads.Some<StoredValue>): Promise<Payloads.Some<StoredValue>> {
    payload.data = false;
    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { value } of this._iterate()) {
        const someValue = await hook(value);

        if (!someValue) continue;

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this._iterate()) {
        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Some }, { key, path }) };
        }

        if (!isPrimitive(data)) {
          return {
            ...payload,
            error: this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Some }, { key, path, type: 'primitive' })
          };
        }

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

    if (!isPayloadWithData<StoredValue>(getPayload)) {
      return { ...payload, error: this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Update }, { key }) };
    }

    const { data } = getPayload;

    await this[Method.Set]({ method: Method.Set, key, path: [], value: await hook(data) });

    return payload;
  }

  public async [Method.Values](payload: Payloads.Values<StoredValue>): Promise<Payloads.Values<StoredValue>> {
    const values = [];

    for await (const { value } of this._iterate()) {
      values.push(value);
    }

    payload.data = values;

    return payload;
  }

  private async *_iterate() {
    const keys = (await this.client.keys('*')) ?? [];
    for (const key of keys) {
      const value = this.deserialize((await this.client.get(key)) as unknown as string);
      yield { key, value };
    }
  }

  private deserialize(value: string): StoredValue {
    if (this.options.disableSerialization) return JSON.parse(value) as StoredValue;

    return new Serialize({ json: JSON.parse(value as string) as Serialize.JSON }).toRaw<StoredValue>();
  }

  private serialize<Value = StoredValue>(value: StoredValue | Value) {
    if (this.options.disableSerialization) return JSON.stringify(value);
    return JSON.stringify(new Serialize({ raw: value }).toJSON());
  }

  private get client(): RedisClientType {
    if (isNullOrUndefined(this._client)) {
      throw this.error({
        message: 'Client is not connected, most likely due to `init` not being called or the server not being available',
        identifier: RedisProvider.Identifiers.NotConnected
      });
    }

    return this._client;
  }
}

export namespace RedisProvider {
  export interface Options {
    connectOptions?: RedisClientOptions;

    expiry?: number;

    disableSerialization?: boolean;
  }

  export type DocType<StoredValue> = string | StoredValue;

  export enum Identifiers {
    NotConnected = 'notConnected'
  }
}
