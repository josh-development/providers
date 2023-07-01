import type { Payload, Semver } from '@joshdb/provider';
import {
  CommonIdentifiers,
  JoshProvider,
  MathOperator,
  Method,
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
  resolveVersion
} from '@joshdb/provider';
import { isNullOrUndefined, isNumber, isPrimitive } from '@sapphire/utilities';
import { Serialize } from 'better-serialize';
import { PROPERTY_NOT_FOUND, deleteProperty, getProperty, hasProperty, setProperty } from 'property-helpers';
import type { RedisClientOptions, RedisClientType } from 'redis';
import { createClient } from 'redis';
import { v4 } from 'uuid';

export class RedisProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: RedisProvider.Options;

  public migrations: JoshProvider.Migration[] = [];

  private _client?: RedisClientType;

  public constructor(options?: RedisProvider.Options) {
    super(options);
  }

  public get version(): Semver {
    return resolveVersion('[VI]{version}[/VI]');
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

  public override async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    this._client = createClient(this.options.connectOptions) as RedisClientType;
    await this._client.connect();
    context = await super.init(context);
    return context;
  }

  public close() {
    return this.client.quit();
  }

  public [Method.AutoKey](payload: Payload.AutoKey): Payload.AutoKey {
    payload.data = v4();

    return payload;
  }

  public async [Method.Clear](payload: Payload.Clear): Promise<Payload.Clear> {
    await this.client.flushAll();
    return payload;
  }

  public async [Method.Dec](payload: Payload.Dec): Promise<Payload.Dec> {
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

  public async [Method.Delete](payload: Payload.Delete): Promise<Payload.Delete> {
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

  public async [Method.DeleteMany](payload: Payload.DeleteMany): Promise<Payload.DeleteMany> {
    const { keys } = payload;

    for (const key of keys) {
      await this.client.del(key);
    }

    return payload;
  }

  public async [Method.Each](payload: Payload.Each<StoredValue>): Promise<Payload.Each<StoredValue>> {
    const { hook } = payload;

    for await (const { key, value } of this.iterate()) {
      await hook(value, key);
    }

    return payload;
  }

  public async [Method.Ensure](payload: Payload.Ensure<StoredValue>): Promise<Payload.Ensure<StoredValue>> {
    const { key } = payload;

    if (!(await this[Method.Has]({ method: Method.Has, errors: [], key, path: [] })).data) {
      await this[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: payload.defaultValue });
    }

    payload.data = (await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] })).data as StoredValue;

    return payload;
  }

  public async [Method.Entries](payload: Payload.Entries<StoredValue>): Promise<Payload.Entries<StoredValue>> {
    payload.data = {};

    const keys = await this.client.keys('*');

    if (keys.length > 0) {
      const values = await this.client.mGet(keys);

      for (const key of keys) {
        const idx = keys.indexOf(key);
        const parsed = JSON.parse(values[idx] as string);
        const deserialized = this.deserialize(parsed.value);

        payload.data[key] = deserialized;
      }
    }

    return payload;
  }

  public async [Method.Every](payload: Payload.Every.ByHook<StoredValue>): Promise<Payload.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payload.Every.ByValue): Promise<Payload.Every.ByValue>;
  public async [Method.Every](payload: Payload.Every<StoredValue>): Promise<Payload.Every<StoredValue>> {
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

  public async [Method.Filter](payload: Payload.Filter.ByHook<StoredValue>): Promise<Payload.Filter.ByHook<StoredValue>>;
  public async [Method.Filter](payload: Payload.Filter.ByValue<StoredValue>): Promise<Payload.Filter.ByValue<StoredValue>>;
  public async [Method.Filter](payload: Payload.Filter<StoredValue>): Promise<Payload.Filter<StoredValue>> {
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

  public async [Method.Find](payload: Payload.Find.ByHook<StoredValue>): Promise<Payload.Find.ByHook<StoredValue>>;
  public async [Method.Find](payload: Payload.Find.ByValue<StoredValue>): Promise<Payload.Find.ByValue<StoredValue>>;
  public async [Method.Find](payload: Payload.Find<StoredValue>): Promise<Payload.Find<StoredValue>> {
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

  public async [Method.Get]<Value = StoredValue>(payload: Payload.Get<Value>): Promise<Payload.Get<Value>> {
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

  public async [Method.GetMany](payload: Payload.GetMany<StoredValue>): Promise<Payload.GetMany<StoredValue>> {
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

  public async [Method.Has](payload: Payload.Has): Promise<Payload.Has> {
    const { key, path } = payload;

    if ((await this.client.exists(key)) === 1) {
      const rowString = await this.client.get(key);

      if (rowString === null) return payload;

      const row = JSON.parse(rowString) as RedisProvider.Row<StoredValue>;

      payload.data = hasProperty(this.deserialize(row.value), path);
    } else payload.data = false;

    return payload;
  }

  public async [Method.Inc](payload: Payload.Inc): Promise<Payload.Inc> {
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

  public async [Method.Keys](payload: Payload.Keys): Promise<Payload.Keys> {
    payload.data = await this.client.keys('*');

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByHook<StoredValue, Value>): Promise<Payload.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByPath<Value>): Promise<Payload.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map<StoredValue, Value>): Promise<Payload.Map<StoredValue, Value>> {
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

  public async [Method.Math](payload: Payload.Math): Promise<Payload.Math> {
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

  public async [Method.Partition](payload: Payload.Partition.ByHook<StoredValue>): Promise<Payload.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payload.Partition.ByValue<StoredValue>): Promise<Payload.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payload.Partition<StoredValue>): Promise<Payload.Partition<StoredValue>> {
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

  public async [Method.Push]<Value = StoredValue>(payload: Payload.Push<Value>): Promise<Payload.Push<Value>> {
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

  public async [Method.Random](payload: Payload.Random<StoredValue>): Promise<Payload.Random<StoredValue>> {
    const docCount = (await this[Method.Size]({ method: Method.Size, errors: [] })).data || 0;
    const { unique } = payload;

    if (unique && docCount < payload.count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random }, { count: payload.count, docCount }));

      return payload;
    }

    if (docCount === 0) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Random }, { count: payload.count, docCount }));

      return payload;
    }

    const keys = await this[Method.Keys]({ method: Method.Keys, errors: [] });

    keys.data = keys.data || [];
    payload.data = [];

    if (unique) {
      const randomKeys = new Set<string>();

      while (randomKeys.size < docCount) randomKeys.add(keys.data[Math.floor(Math.random() * keys.data.length)]);

      for (const key of randomKeys) {
        const getPayload = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

        payload.data.push(getPayload.data as StoredValue);
      }
    } else {
      for (let i = 0; i < payload.count; i++) {
        const key = keys.data[Math.floor(Math.random() * keys.data.length)];
        const getPayload = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

        payload.data.push(getPayload.data as StoredValue);
      }
    }

    return payload;
  }

  public async [Method.RandomKey](payload: Payload.RandomKey): Promise<Payload.RandomKey> {
    const docCount = (await this[Method.Size]({ method: Method.Size, errors: [] })).data || 0;
    const { unique } = payload;

    if (unique && docCount < payload.count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.RandomKey }, { count: payload.count, docCount }));

      return payload;
    }

    if (docCount === 0) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Random }, { count: payload.count, docCount }));

      return payload;
    }

    const keys = await this[Method.Keys]({ method: Method.Keys, errors: [] });

    keys.data = keys.data || [];
    payload.data = [];

    if (unique) {
      const randomKeys = new Set<string>();

      while (randomKeys.size < docCount) randomKeys.add(keys.data[Math.floor(Math.random() * keys.data.length)]);

      payload.data = Array.from(randomKeys);
    } else {
      for (let i = 0; i < payload.count; i++) {
        const key = keys.data[Math.floor(Math.random() * keys.data.length)];

        payload.data.push(key);
      }
    }

    return payload;
  }

  public async [Method.Remove]<HookValue = StoredValue>(payload: Payload.Remove.ByHook<HookValue>): Promise<Payload.Remove.ByHook<HookValue>>;
  public async [Method.Remove](payload: Payload.Remove.ByValue): Promise<Payload.Remove.ByValue>;
  public async [Method.Remove]<HookValue = StoredValue>(payload: Payload.Remove<HookValue>): Promise<Payload.Remove<HookValue>> {
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

  public async [Method.Set]<Value = StoredValue>(payload: Payload.Set<Value>): Promise<Payload.Set<Value>> {
    const { key, path, value } = payload;
    const val = path.length > 0 ? setProperty((await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] })).data, path, value) : value;

    if (key.startsWith('__')) {
      payload.errors.push(this.error({ identifier: 'invalidKey', method: Method.Set }, { key }));

      return payload;
    }

    await this.client.set(key, JSON.stringify({ value: this.serialize(val as StoredValue) }), { EX: this.options.expiry });

    return payload;
  }

  public async [Method.SetMany](payload: Payload.SetMany): Promise<Payload.SetMany> {
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

  public async [Method.Size](payload: Payload.Size): Promise<Payload.Size> {
    payload.data = (await this.client.dbSize()) ?? payload.data;

    return payload;
  }

  public async [Method.Some](payload: Payload.Some.ByHook<StoredValue>): Promise<Payload.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payload.Some.ByValue): Promise<Payload.Some.ByValue>;
  public async [Method.Some](payload: Payload.Some<StoredValue>): Promise<Payload.Some<StoredValue>> {
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

  public async [Method.Update]<Value = StoredValue>(payload: Payload.Update<StoredValue, Value>): Promise<Payload.Update<StoredValue, Value>> {
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

  public async [Method.Values](payload: Payload.Values<StoredValue>): Promise<Payload.Values<StoredValue>> {
    const values = [];

    for await (const { value } of this.iterate()) values.push(value);

    payload.data = values;

    return payload;
  }

  public async deleteMetadata(key: string): Promise<void> {
    const metadata = (await this.client.get('__metadata__')) || '{}';
    const parsed = JSON.parse(metadata) as { [key: string]: unknown };

    delete parsed[key];
    await this.client.set('__metadata__', JSON.stringify(parsed));
  }

  public async setMetadata(key: string, value: unknown): Promise<void> {
    const metadata = (await this.client.get('__metadata__')) || '{}';
    const parsed = JSON.parse(metadata) as { [key: string]: unknown };

    parsed[key] = value;
    await this.client.set('__metadata__', JSON.stringify(parsed));
  }

  public async getMetadata<Value = unknown>(key: string): Promise<Value> {
    const metadata = (await this.client.get('__metadata__')) || '{}';
    const parsed = JSON.parse(metadata) as { [key: string]: unknown };

    return parsed[key] as Value;
  }

  protected async fetchVersion(): Promise<Semver> {
    const metadataVersion = await this.getMetadata<Semver>('version');

    if (metadataVersion) {
      return metadataVersion;
    }

    const docs = await this.client.dbSize();

    if (docs === 0) {
      await this.setMetadata('version', this.version);
    }

    return { major: 1, minor: 0, patch: 0 };
  }

  private async *iterate(): AsyncIterableIterator<RedisProvider.IterateReturn<StoredValue>> {
    for await (const key of this.client.scanIterator()) {
      const rowString = await this.client.get(key);

      if (rowString === null) continue;

      const row = JSON.parse(rowString) as RedisProvider.Row<StoredValue>;

      yield { key, value: this.deserialize(row.value) };
    }
  }

  private deserialize(value: Serialize.JsonCompatible | StoredValue): StoredValue {
    if (this.options.disableSerialization) return value as StoredValue;
    return Serialize.fromJsonCompatible(value as Serialize.JsonCompatible) as StoredValue;
  }

  private serialize<StoredValue>(value: StoredValue) {
    if (this.options.disableSerialization) return value;
    return Serialize.toJsonCompatible(value) as Serialize.JsonCompatible;
  }
}

export namespace RedisProvider {
  export interface Options extends JoshProvider.Options {
    connectOptions?: RedisClientOptions;

    expiry?: number;

    disableSerialization?: boolean;
  }

  export interface Row<StoredValue> {
    value: StoredValue | Serialize.JsonCompatible;

    version: Semver;
  }

  export interface IterateReturn<StoredValue = unknown> {
    key: string;

    value: StoredValue;
  }

  export enum Identifiers {
    NotConnected = 'notConnected'
  }
}
