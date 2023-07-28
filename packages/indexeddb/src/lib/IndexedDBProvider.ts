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
  Payload,
  resolveVersion,
  type Semver
} from '@joshdb/provider';
import { isPrimitive } from '@sapphire/utilities';
import { deleteProperty, getProperty, hasProperty, PROPERTY_NOT_FOUND, setProperty } from 'property-helpers';
import { DatabaseHandler } from './DatabaseHandler';

export class IndexedDBProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: IndexedDBProvider.Options;

  public get version() {
    return process.env.NODE_ENV === 'test' ? { major: 2, minor: 0, patch: 0 } : resolveVersion('[VI]{version}[/VI]');
  }

  public migrations: JoshProvider.Migration[] = [];

  private _handler?: DatabaseHandler<StoredValue>;

  public constructor(options: IndexedDBProvider.Options) {
    super(options);
  }

  private get handler(): DatabaseHandler<StoredValue> {
    if (this._handler instanceof DatabaseHandler) return this._handler;

    throw this.error(IndexedDBProvider.Identifiers.DatabaseHandlerNotFound);
  }

  public override async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    if ('indexedDB' in globalThis === false) {
      throw this.error(IndexedDBProvider.Identifiers.MissingIndexedDB);
    }

    const { name } = context;

    this._handler = new DatabaseHandler<StoredValue>({ name, version: this.version });

    await this.handler.init();

    context = await super.init(context);

    return context;
  }

  public async deleteMetadata(key: string): Promise<void> {
    await this.handler.deleteMetadata(key);
  }

  public async getMetadata<T = unknown>(key: string): Promise<T> {
    return this.handler.getMetadata(key) as Promise<T>;
  }

  public async setMetadata(key: string, value: unknown): Promise<void> {
    await this.handler.setMetadata(key, value);
  }

  public async [Method.AutoKey](payload: Payload.AutoKey): Promise<Payload.AutoKey> {
    let autoKey = await this.getMetadata<number>('autoKey');

    autoKey++;
    payload.data = autoKey.toString();

    await this.setMetadata('autoKey', autoKey);

    return payload;
  }

  public async [Method.Clear](payload: Payload.Clear): Promise<Payload.Clear> {
    await this.handler.clear();

    return payload;
  }

  public async [Method.Dec](payload: Payload.Dec): Promise<Payload.Dec> {
    const { key, path } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, errors: [], key, path });

    if (!isPayloadWithData(getPayload)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Dec }, { key, path }));

      return payload;
    }

    const { data } = getPayload;

    if (typeof data !== 'number') {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Dec }, { key, path, type: 'number' }));

      return payload;
    }

    this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payload.Delete): Promise<Payload.Delete> {
    const { key, path } = payload;

    if (path.length === 0) {
      await this.handler.delete(key);
    }

    if (await this.handler.has(key)) {
      const value = await this.handler.get(key);

      deleteProperty(value, path);
      await this.handler.set(key, value);
    }

    return payload;
  }

  public async [Method.DeleteMany](payload: Payload.DeleteMany): Promise<Payload.DeleteMany> {
    const { keys } = payload;

    await this.handler.deleteMany(keys);

    return payload;
  }

  public async [Method.Each](payload: Payload.Each<StoredValue>): Promise<Payload.Each<StoredValue>> {
    const { hook } = payload;

    for (const [key, value] of await this.handler.entries()) {
      await hook(value, key);
    }

    return payload;
  }

  public async [Method.Ensure]<Value = StoredValue>(payload: Payload.Ensure<Value>): Promise<Payload.Ensure<Value>> {
    const { key, defaultValue } = payload;

    payload.data = defaultValue;

    if (await this.handler.has(key)) {
      payload.data = await this.handler.get(key);
    } else {
      await this.handler.set(key, defaultValue);
    }

    return payload;
  }

  public async [Method.Entries](payload: Payload.Entries<StoredValue>): Promise<Payload.Entries<StoredValue>> {
    payload.data = {};

    for (const [key, value] of await this.handler.entries()) {
      payload.data[key] = value;
    }

    return payload;
  }

  public async [Method.Every](payload: Payload.Every.ByHook<StoredValue>): Promise<Payload.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payload.Every.ByValue): Promise<Payload.Every.ByValue>;
  public async [Method.Every](payload: Payload.Every<StoredValue>): Promise<Payload.Every<StoredValue>> {
    payload.data = true;

    const size = await this.handler.size();

    if (size === 0) {
      return payload;
    }

    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of await this.handler.entries()) {
        const result = await hook(value, key);

        if (result) {
          continue;
        }

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
        const data = getProperty(storedValue, path);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Every }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Every }, { key, path, type: 'primitive' }));

          return payload;
        }

        if (data === value) {
          continue;
        }

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

      for (const [key, value] of await this.handler.entries()) {
        if (await hook(value, key)) {
          payload.data[key] = value;
        }
      }
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Filter }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Filter }, { key, path, type: 'primitive' }));

          return payload;
        }

        if (data === value) {
          payload.data[key] = storedValue;
        }
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

      for (const [key, value] of await this.handler.entries()) {
        const result = await hook(value, key);

        if (!result) {
          continue;
        }

        payload.data = [key, value];

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Find }, { path, type: 'primitive' }));

        return payload;
      }

      for (const [key, storedValue] of await this.handler.entries()) {
        if (payload.data[0] !== null && payload.data[1] !== null) {
          break;
        }

        const data = getProperty(storedValue, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Find }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Find }, { key, path, type: 'primitive' }));

          return payload;
        }

        if (data !== value) {
          continue;
        }

        payload.data = [key, storedValue];

        break;
      }
    }

    return payload;
  }

  public async [Method.Get]<Value = StoredValue>(payload: Payload.Get<Value>): Promise<Payload.Get<Value>> {
    const { key, path } = payload;

    if (path.length === 0) {
      if (await this.handler.has(key)) {
        payload.data = await this.handler.get(key);
      }
    } else {
      const data = getProperty<Value>(await this.handler.get(key), path);

      if (data !== PROPERTY_NOT_FOUND) {
        payload.data = data;
      }
    }

    return payload;
  }

  public async [Method.GetMany](payload: Payload.GetMany<StoredValue>): Promise<Payload.GetMany<StoredValue>> {
    const { keys } = payload;

    payload.data = await this.handler.getMany(keys);

    return payload;
  }

  public async [Method.Has](payload: Payload.Has): Promise<Payload.Has> {
    const { key, path } = payload;

    payload.data = (await this.handler.has(key)) ?? hasProperty(await this.handler.get(key), path);

    return payload;
  }

  public async [Method.Inc](payload: Payload.Inc): Promise<Payload.Inc> {
    const { key, path } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, errors: [], key, path });

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
    payload.data = await this.handler.keys();

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByHook<StoredValue, Value>): Promise<Payload.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByPath<Value>): Promise<Payload.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map<StoredValue, Value>): Promise<Payload.Map<StoredValue, Value>> {
    payload.data = [];

    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of await this.handler.entries()) {
        payload.data.push(await hook(value, key));
      }
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for (const value of await this.handler.values()) {
        const data = getProperty<Value>(value, path);

        if (data !== PROPERTY_NOT_FOUND) {
          payload.data.push(data);
        }
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

    this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data });

    return payload;
  }

  public async [Method.Partition](payload: Payload.Partition.ByHook<StoredValue>): Promise<Payload.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payload.Partition.ByValue<StoredValue>): Promise<Payload.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payload.Partition<StoredValue>): Promise<Payload.Partition<StoredValue>> {
    payload.data = { truthy: {}, falsy: {} };

    if (isPartitionByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of await this.handler.entries()) {
        const result = await hook(value, key);

        if (result) {
          payload.data.truthy[key] = value;
        } else {
          payload.data.falsy[key] = value;
        }
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
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

        if (value === data) {
          payload.data.truthy[key] = storedValue;
        } else {
          payload.data.falsy[key] = storedValue;
        }
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

  public async [Method.Random]<Value = StoredValue>(payload: Payload.Random<Value>): Promise<Payload.Random<Value>> {
    const { count, unique } = payload;
    const size = await this.handler.size();

    if (unique && size < count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random }));

      return payload;
    }

    if (size === 0) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Random, context: { unique, count } }));

      return payload;
    }

    payload.data = [];

    const keys = await this.handler.keys();

    if (unique) {
      const randomKeys = new Set<string>();

      while (randomKeys.size < count) {
        randomKeys.add(keys[Math.floor(Math.random() * keys.length)]);
      }

      for (const key of randomKeys) {
        payload.data.push((await this.handler.get(key))!);
      }
    } else {
      while (payload.data.length < count) {
        const key = keys[Math.floor(Math.random() * keys.length)];

        payload.data.push((await this.handler.get(key))!);
      }
    }

    return payload;
  }

  public async [Method.RandomKey](payload: Payload.RandomKey): Promise<Payload.RandomKey> {
    const { count, unique } = payload;
    const size = await this.handler.size();

    if (unique && size < count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.RandomKey }));

      return payload;
    }

    if (size === 0) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.RandomKey }));

      return payload;
    }

    payload.data = [];

    const keys = Array.from(await this.handler.keys());

    if (unique) {
      const randomKeys = new Set<string>();

      while (randomKeys.size < count) {
        randomKeys.add(keys[Math.floor(Math.random() * keys.length)]);
      }

      for (const key of randomKeys) {
        payload.data.push(key);
      }
    } else {
      while (payload.data.length < count) {
        payload.data.push(keys[Math.floor(Math.random() * keys.length)]);
      }
    }

    return payload;
  }

  public async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove.ByHook<Value>): Promise<Payload.Remove.ByHook<Value>>;
  public async [Method.Remove](payload: Payload.Remove.ByValue): Promise<Payload.Remove.ByValue>;
  public async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove<Value>): Promise<Payload.Remove<Value>> {
    if (isRemoveByHookPayload(payload)) {
      const { key, path, hook } = payload;
      const getPayload = await this[Method.Get]<Value[]>({ method: Method.Get, errors: [], key, path });

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

    if (path.length === 0) {
      await this.handler.set(key, value as unknown as StoredValue);
    } else {
      const storedValue = await this.handler.get(key);

      await this.handler.set(key, setProperty(storedValue, path, value));
    }

    return payload;
  }

  public async [Method.SetMany](payload: Payload.SetMany): Promise<Payload.SetMany> {
    const { entries, overwrite } = payload;

    for (const { key, path, value } of entries) {
      if (overwrite) {
        await this[Method.Set]({ method: Method.Set, errors: [], key, path, value });
      } else if (!(await this[Method.Has]({ method: Method.Has, errors: [], key, path })).data) {
        await this[Method.Set]({ method: Method.Set, errors: [], key, path, value });
      }
    }

    return payload;
  }

  public async [Method.Size](payload: Payload.Size): Promise<Payload.Size> {
    payload.data = await this.handler.size();

    return payload;
  }

  public async [Method.Some](payload: Payload.Some.ByHook<StoredValue>): Promise<Payload.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payload.Some.ByValue): Promise<Payload.Some.ByValue>;
  public async [Method.Some](payload: Payload.Some<StoredValue>): Promise<Payload.Some<StoredValue>> {
    payload.data = false;

    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of await this.handler.entries()) {
        const result = await hook(value, key);

        if (!result) {
          continue;
        }

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
        const data = getProperty(storedValue, path);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Some }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Some }, { key, path, type: 'primitive' }));

          return payload;
        }

        if (data !== value) {
          continue;
        }

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
    payload.data = await this.handler.values();

    return payload;
  }

  protected fetchVersion() {
    return this.getMetadata<Semver>('version');
  }
}

export namespace IndexedDBProvider {
  export interface Options {}

  export enum Identifiers {
    DatabaseHandlerNotFound = 'databaseHandlerNotFound',

    MissingIndexedDB = 'missingIndexedDB',

    NotInitialized = 'notInitialized'
  }
}
