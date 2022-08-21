import {
  CommonIdentifiers,
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
  Payloads
} from '@joshdb/provider';
import { SerializeJSON, toJSON, toRaw } from '@joshdb/serialize';
import { isNullOrUndefined, isNumber, isPrimitive } from '@sapphire/utilities';
import { deleteProperty, getProperty, hasProperty, PROPERTY_NOT_FOUND, setProperty } from 'property-helpers';
import { createClient, RedisClientOptions, RedisClientType } from 'redis';
import { v4 } from 'uuid';

export class RedisProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: RedisProvider.Options;

  public migrations: JoshProvider.Migration[] = [];

  private _client?: RedisClientType;

  public constructor(options?: RedisProvider.Options) {
    super(options);
  }

  public get version(): JoshProvider.Semver {
    return this.resolveVersion('[VI]{version}[/VI]');
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

  public async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    this._client = createClient(this.options.connectOptions) as RedisClientType;
    await this._client.connect();
    context = await super.init(context);
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
    const getPayload = await this[Method.Get]<StoredValue>({ method: Method.Get, errors: [], key, path });

    if (!isPayloadWithData(getPayload)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Dec }, { key, path }));

      return payload;
    }

    const { data } = getPayload;

    if (!isNumber(data)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Dec }, { key, path, type: 'number' }));

      return payload;
    }

    await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payloads.Delete): Promise<Payloads.Delete> {
    const { key, path } = payload;

    if (path.length === 0) {
      await this.client.del(key);

      return payload;
    }

    if ((await this[Method.Has]({ method: Method.Has, errors: [], key, path })).data) {
      const { data } = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      deleteProperty(data, path);
      await this[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: data });

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

    for await (const { key, value } of this.iterate()) {
      await hook(value, key);
    }

    return payload;
  }

  public async [Method.Ensure](payload: Payloads.Ensure<StoredValue>): Promise<Payloads.Ensure<StoredValue>> {
    const { key } = payload;

    if (!(await this[Method.Has]({ method: Method.Has, errors: [], key, path: [] })).data) {
      await this[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: payload.defaultValue });
    }

    payload.data = (await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] })).data as StoredValue;

    return payload;
  }

  public async [Method.Entries](payload: Payloads.Entries<StoredValue>): Promise<Payloads.Entries<StoredValue>> {
    payload.data = {};

    for await (const doc of this.iterate()) payload.data[doc.key] = doc.value;

    return payload;
  }

  public async [Method.Every](payload: Payloads.Every.ByHook<StoredValue>): Promise<Payloads.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  public async [Method.Every](payload: Payloads.Every<StoredValue>): Promise<Payloads.Every<StoredValue>> {
    payload.data = true;

    if ((await this[Method.Size]({ method: Method.Size, errors: [] })).data === 0) return payload;
    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { key, value } of this.iterate()) {
        const result = await hook(value, key);

        if (result) continue;

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const data = getProperty(storedValue, path);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Every }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Every }, { key, path, type: 'primitive' }));

          return payload;
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

      for await (const { key, value } of this.iterate()) {
        const filterValue = await hook(value, key);

        if (!filterValue) continue;

        payload.data[key] = value;
      }
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Filter }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Filter }, { key, path, type: 'primitive' }));

          return payload;
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

      for await (const { key, value } of this.iterate()) {
        const result = await hook(value, key);

        if (!result) continue;

        payload.data = [key, value];

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        if (payload.data[0] !== null && payload.data[1] !== null) break;

        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Find }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Find }, { key, path, type: 'primitive' }));

          return payload;
        }

        if (data !== value) continue;

        payload.data = [key, storedValue];

        break;
      }
    }

    return payload;
  }

  public async [Method.Get]<Value = StoredValue>(payload: Payloads.Get<Value>): Promise<Payloads.Get<Value>> {
    const { key, path } = payload;
    const rowString = await this.client.get(key);

    if (rowString === null) return payload;

    const row = JSON.parse(rowString) as RedisProvider.Row<StoredValue>;

    if (path.length === 0) payload.data = this.deserialize(row.value) as unknown as Value;
    else {
      const data = getProperty<Value>(this.deserialize(row.value), path);

      if (data !== PROPERTY_NOT_FOUND) payload.data = data;
    }

    return payload;
  }

  public async [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Promise<Payloads.GetMany<StoredValue>> {
    payload.data = {};

    const { keys } = payload;

    for (const key of keys) {
      const rowString = await this.client.get(key);

      if (rowString === null) payload.data[key] = null;
      else {
        const row = JSON.parse(rowString) as RedisProvider.Row<StoredValue>;

        payload.data[key] = this.deserialize(row.value);
      }
    }

    return payload;
  }

  public async [Method.Has](payload: Payloads.Has): Promise<Payloads.Has> {
    const { key, path } = payload;

    if ((await this.client.exists(key)) === 1) {
      const rowString = await this.client.get(key);

      if (rowString === null) return payload;

      const row = JSON.parse(rowString) as RedisProvider.Row<StoredValue>;

      payload.data = hasProperty(this.deserialize(row.value), path);
    } else payload.data = false;

    return payload;
  }

  public async [Method.Inc](payload: Payloads.Inc): Promise<Payloads.Inc> {
    const { key, path } = payload;
    const getPayload = await this[Method.Get]<StoredValue>({ method: Method.Get, errors: [], key, path });

    if (!isPayloadWithData(getPayload)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Inc }, { key, path }));

      return payload;
    }

    const { data } = getPayload;

    if (typeof data !== 'number') {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Inc }, { key, path, type: 'number' }));

      return payload;
    }

    await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data + 1 });

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

      for await (const { key, value } of this.iterate()) payload.data.push(await hook(value, key));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for await (const { value } of this.iterate()) {
        const data = getProperty<Value>(value, path);

        if (data !== PROPERTY_NOT_FOUND) payload.data.push(data);
      }
    }

    return payload;
  }

  public async [Method.Math](payload: Payloads.Math): Promise<Payloads.Math> {
    const { key, path, operator, operand } = payload;
    const getPayload = await this[Method.Get]<number>({ method: Method.Get, errors: [], key, path });

    if (!isPayloadWithData(getPayload)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Math }, { key, path }));

      return payload;
    }

    let { data } = getPayload;

    if (typeof data !== 'number') {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Math }, { key, path, type: 'number' }));

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

    await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data });

    return payload;
  }

  public async [Method.Partition](payload: Payloads.Partition.ByHook<StoredValue>): Promise<Payloads.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition.ByValue<StoredValue>): Promise<Payloads.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition<StoredValue>): Promise<Payloads.Partition<StoredValue>> {
    payload.data = { truthy: {}, falsy: {} };

    if (isPartitionByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { key, value } of this.iterate()) {
        const result = await hook(value, key);

        if (result) payload.data.truthy[key] = value;
        else payload.data.falsy[key] = value;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const data = getProperty<StoredValue>(storedValue, path);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Partition }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(
            this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Partition }, { key, path, type: 'primitive' })
          );

          return payload;
        }

        if (value === data) payload.data.truthy[key] = storedValue;
        else payload.data.falsy[key] = storedValue;
      }
    }

    return payload;
  }

  public async [Method.Push]<Value = StoredValue>(payload: Payloads.Push<Value>): Promise<Payloads.Push<Value>> {
    const { key, path, value } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, errors: [], key, path });

    if (!isPayloadWithData(getPayload)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Push }, { key, path }));

      return payload;
    }

    const { data } = getPayload;

    if (!Array.isArray(data)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Push }, { key, path, type: 'array' }));

      return payload;
    }

    data.push(value);
    await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data });

    return payload;
  }

  public async [Method.Random](payload: Payloads.Random<StoredValue>): Promise<Payloads.Random<StoredValue>> {
    const docCount = (await this[Method.Size]({ method: Method.Size, errors: [] })).data || 0;

    if (docCount === 0) return payload;
    if (docCount < payload.count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random }, { count: payload.count, docCount }));

      return payload;
    }

    const keys = await this[Method.Keys]({ method: Method.Keys, errors: [] });

    keys.data = keys.data || [];
    payload.data = [];

    for (let i = 0; i < payload.count; i++) {
      const key = keys.data[Math.floor(Math.random() * keys.data.length)];
      const getPayload = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      payload.data.push(getPayload.data as StoredValue);
    }

    return payload;
  }

  public async [Method.RandomKey](payload: Payloads.RandomKey): Promise<Payloads.RandomKey> {
    const docCount = (await this[Method.Size]({ method: Method.Size, errors: [] })).data || 0;

    if (docCount === 0) return payload;
    if (docCount < payload.count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.RandomKey }, { count: payload.count, docCount }));

      return payload;
    }

    const keys = await this[Method.Keys]({ method: Method.Keys, errors: [] });

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
      const getPayload = await this[Method.Get]<HookValue[]>({ method: Method.Get, errors: [], key, path });

      if (!isPayloadWithData(getPayload)) {
        payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Remove }, { key, path }));

        return payload;
      }

      const { data } = getPayload;

      if (!Array.isArray(data)) {
        payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Remove }, { key, path, type: 'array' }));

        return payload;
      }

      const filterValues = await Promise.all(data.map((value) => hook(value, key)));

      await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data.filter((_, index) => !filterValues[index]) });
    }

    if (isRemoveByValuePayload(payload)) {
      const { key, path, value } = payload;
      const getPayload = await this[Method.Get]({ method: Method.Get, errors: [], key, path });

      if (!isPayloadWithData(getPayload)) {
        payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Remove }, { key, path }));

        return payload;
      }

      const { data } = getPayload;

      if (!Array.isArray(data)) {
        payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Remove }, { key, path, type: 'array' }));

        return payload;
      }

      await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data.filter((storedValue) => value !== storedValue) });
    }

    return payload;
  }

  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
    const { key, path, value } = payload;
    const val = path.length > 0 ? setProperty((await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] })).data, path, value) : value;

    await this.client.set(key, JSON.stringify({ value: this.serialize(val as StoredValue), version: this.version }), { EX: this.options.expiry });

    return payload;
  }

  public async [Method.SetMany](payload: Payloads.SetMany): Promise<Payloads.SetMany> {
    const { entries } = payload;
    const operations = [];

    for (const { key, path, value } of entries) {
      if (!payload.overwrite) {
        const found = (await this[Method.Has]({ method: Method.Has, errors: [], key, path })).data;

        if (found) continue;
      }

      const val =
        path.length > 0 ? setProperty((await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] })).data, path, value) : value;

      operations.push(this[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: val }));
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

      for await (const { key, value } of this.iterate()) {
        const someValue = await hook(value, key);

        if (!someValue) continue;

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const data = getProperty(storedValue, path);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Some }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Some }, { key, path, type: 'primitive' }));

          return payload;
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
    const getPayload = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData<StoredValue>(getPayload)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Update }, { key }));

      return payload;
    }

    const { data } = getPayload;

    await this[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: await hook(data, key) });

    return payload;
  }

  public async [Method.Values](payload: Payloads.Values<StoredValue>): Promise<Payloads.Values<StoredValue>> {
    const values = [];

    for await (const { value } of this.iterate()) values.push(value);

    payload.data = values;

    return payload;
  }

  protected async fetchVersion(): Promise<JoshProvider.Semver> {
    for await (const { version } of this.iterate()) return version;

    return this.version;
  }

  private async *iterate(): AsyncIterableIterator<IterateReturn<StoredValue>> {
    for await (const key of this.client.scanIterator()) {
      const rowString = await this.client.get(key);

      if (rowString === null) continue;

      const row = JSON.parse(rowString) as RedisProvider.Row<StoredValue>;

      yield { key, value: this.deserialize(row.value), version: row.version };
    }
  }

  private deserialize(value: SerializeJSON | StoredValue): StoredValue {
    if (this.options.disableSerialization) return value as StoredValue;
    return toRaw(value as SerializeJSON) as StoredValue;
  }

  private serialize<StoredValue>(value: StoredValue) {
    if (this.options.disableSerialization) return value;
    return toJSON(value) as SerializeJSON;
  }
}

export namespace RedisProvider {
  export interface Options extends JoshProvider.Options {
    connectOptions?: RedisClientOptions;

    expiry?: number;

    disableSerialization?: boolean;
  }

  export interface Row<StoredValue> {
    value: StoredValue | SerializeJSON;

    version: JoshProvider.Semver;
  }

  export enum Identifiers {
    NotConnected = 'notConnected'
  }
}

interface IterateReturn<StoredValue = unknown> {
  key: string;

  value: StoredValue;

  version: JoshProvider.Semver;
}
