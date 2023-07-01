// // @ts-nocheck
import {
  CommonIdentifiers,
  isFilterByHookPayload,
  isFilterByValuePayload,
  isFindByHookPayload,
  isFindByValuePayload,
  isMapByHookPayload,
  isMapByPathPayload,
  JoshProvider,
  MathOperator,
  Method,
  Payload,
  type Semver
} from '@joshdb/provider';
import { deleteProperty, getProperty, hasProperty, PROPERTY_NOT_FOUND, setProperty } from 'property-helpers';
import DbHandler from './DbHandler';
import { handleSubCallFail, isPrimitive, version } from './helpers';

export class IndexedDBProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public version: Semver = version;
  public declare options: IndexedDBProvider.Options;

  private db: DbHandler;

  public constructor(options: IndexedDBProvider.Options) {
    super(options);
    this.db = new DbHandler<StoredValue>();
  }

  public deleteMetadata(key: string): void {
    return this.db.deleteMetadata(key);
  }

  public getMetadata(key: string): unknown {
    return this.db.getMetadata(key);
  }

  public setMetadata(key: string, value: unknown): void {
    return this.db.setMetadata(key, value);
  }

  public async [Method.Each]<Value = StoredValue>(payload: Payload.Each<Value>): Promise<Payload.Each<Value>> {
    await this.check();

    const { hook } = payload;
    const data = await this.db.getAll();

    // @ts-expect-error 2322 Start making sense.
    Object.entries(data).forEach(([key, value]) => hook(value, key));

    return payload;
  }

  public async [Method.DeleteMany](payload: Payload.DeleteMany): Promise<Payload.DeleteMany> {
    await this.check();

    for (const key of payload.keys) {
      await this.db.delete(key);
    }

    return payload;
  }

  public async [Method.Delete](payload: Payload.Delete): Promise<Payload.Delete> {
    await this.check();

    const { key, path } = payload;

    if (path.length) {
      const value = await this.db.get(key);

      deleteProperty(value, path);
      await this.db.set(key, value);
    } else {
      await this.db.delete(key);
    }

    return payload;
  }

  public async [Method.AutoKey](payload: Payload.AutoKey): Promise<Payload.AutoKey> {
    await this.check();

    payload.data = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    return payload;
  }

  public async [Method.Values]<Value = StoredValue>(payload: Payload.Values<Value>): Promise<Payload.Values<Value>> {
    await this.check();

    payload.data = Object.values(await this.db.getAll());

    return payload;
  }

  public async [Method.Math](payload: Payload.Math): Promise<Payload.Math> {
    await this.check();

    const { key, path, operator, operand } = payload;
    const getPayload = await this[Method.Get]<number | typeof PROPERTY_NOT_FOUND>({ method: Method.Get, key, path, errors: [] });

    if (handleSubCallFail(getPayload, payload)) return payload;
    if (getPayload.data === undefined || getPayload.data === PROPERTY_NOT_FOUND) {
      payload.errors = [this.error({ identifier: CommonIdentifiers.MissingData })];
      return payload;
    }

    let { data } = getPayload;

    if (typeof data !== 'number') {
      payload.errors = [this.error({ identifier: CommonIdentifiers.InvalidDataType })];
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

    handleSubCallFail(await this[Method.Set]({ method: Method.Set, key, path, value: data, errors: [] }), payload);

    return payload;
  }

  public async [Method.Dec](payload: Payload.Dec): Promise<Payload.Dec> {
    await this.check();

    const { key, path } = payload;
    const mathPayload = await this[Method.Math]({
      method: Method.Math,
      key,
      path,
      operand: 1,
      operator: MathOperator.Subtraction,
      errors: []
    });

    handleSubCallFail(mathPayload, payload);

    return payload;
  }

  public async [Method.Inc](payload: Payload.Inc): Promise<Payload.Inc> {
    await this.check();

    const { key, path } = payload;
    const mathPayload = await this[Method.Math]({
      method: Method.Math,
      key,
      path,
      operand: 1,
      operator: MathOperator.Addition,
      errors: []
    });

    handleSubCallFail(mathPayload, payload);

    return payload;
  }

  public async [Method.Keys](payload: Payload.Keys): Promise<Payload.Keys> {
    await this.check();

    payload.data = await this.db.getKeys();

    return payload;
  }

  public async [Method.RandomKey](payload: Payload.RandomKey): Promise<Payload.RandomKey> {
    await this.check();

    const { count, unique } = payload;
    const keys = await this.db.getKeys();

    if (unique && keys.length < count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount }));
      return payload;
    }

    if (keys.length === 0) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData }));
      return payload;
    }

    payload.data = [];

    if (unique && keys.length === count) {
      payload.data = keys;
      return payload;
    }

    while (payload.data.length < count) {
      const rand = keys[Math.floor(Math.random() * keys.length)];

      if (unique && payload.data.includes(rand)) continue;
      payload.data.push(rand);
    }

    return payload;
  }

  public async [Method.Random]<Value = StoredValue>(payload: Payload.Random<Value>): Promise<Payload.Random<Value>> {
    await this.check();

    // @ts-expect-error 2532 STFU
    const key = await this.randomKey(payload);

    if (key.data) {
      payload.data = await Promise.all(key.data.map((key) => this.db.get(key)));
    }

    return payload;
  }

  public override async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    await this.db.init(context);
    context = await super.init(context);

    return context;
  }

  public async [Method.Get]<Value = StoredValue>(payload: Payload.Get<Value>): Promise<Payload.Get<Value>> {
    await this.check();

    const { key, path } = payload;
    const value = await this.db.get(key);

    payload.data = path.length === 0 ? value : getProperty(value, path);

    return payload;
  }

  public async [Method.Entries](payload: Payload.Entries<StoredValue>): Promise<Payload.Entries<StoredValue>> {
    await this.check();

    payload.data = await this.db.getAll();

    return payload;
  }

  public async [Method.GetMany](payload: Payload.GetMany<StoredValue>): Promise<Payload.GetMany<StoredValue>> {
    await this.check();
    // according to old method this could be made into an index search

    const { keys } = payload;
    const data: { [key: string]: StoredValue } = await this.db.getAll();

    payload.data = {};

    Object.entries(data).forEach(([key, val]) => {
      if (keys.includes(key)) {
        // @ts-expect-error 2532 No it's not
        payload.data[key] = val;
      }
    });

    return payload;
  }

  public async [Method.Set]<Value = StoredValue>(payload: Payload.Set<Value>): Promise<Payload.Set<Value>> {
    await this.check();

    const { key, value, path } = payload;
    let data = (await this.db.get(key)) || {};

    if (path.length === 0) {
      data = value;
    } else {
      setProperty(data, path, value);
    }

    await this.db.set(key, data);

    return payload;
  }

  public async [Method.SetMany](payload: Payload.SetMany): Promise<Payload.SetMany> {
    await this.check();

    const { entries, overwrite } = payload;

    for (const { key, path, value } of entries) {
      const found = overwrite ? false : await this[Method.Get]({ key, method: Method.Get, path, errors: [] });

      if (!found) {
        handleSubCallFail(await this[Method.Set]({ key, value, path, method: Method.Set, errors: [] }), payload);
      }
    }

    return payload;
  }

  public async [Method.Clear](payload: Payload.Clear): Promise<Payload.Clear> {
    await this.check();
    await this.db.clear();

    return payload;
  }

  public async [Method.Has](payload: Payload.Has): Promise<Payload.Has> {
    await this.check();

    const { key, path } = payload;

    if (await this.db.has(key)) {
      payload.data = true;

      if (path.length !== 0) payload.data = hasProperty(await this.db.get(key), path);
    } else payload.data = false;

    return payload;
  }

  public async [Method.Size](payload: Payload.Size): Promise<Payload.Size> {
    await this.check();
    payload.data = await this.db.count();

    return payload;
  }

  public async [Method.Push]<Value = StoredValue>(payload: Payload.Push<Value>): Promise<Payload.Push<Value>> {
    await this.check();
    return payload;
  }

  public async [Method.Ensure]<Value = StoredValue>(payload: Payload.Ensure<Value>): Promise<Payload.Ensure<Value>> {
    await this.check();

    const { key, defaultValue } = payload;

    payload.data = defaultValue;

    const getPayload = await this[Method.Get]<Value | typeof PROPERTY_NOT_FOUND>({ method: Method.Get, key, errors: [], path: [] });

    if (handleSubCallFail(getPayload, payload)) return payload;
    if (getPayload.data !== undefined && getPayload.data !== PROPERTY_NOT_FOUND) {
      payload.data = getPayload.data;
    } else {
      handleSubCallFail(await this[Method.Set]({ method: Method.Set, key, path: [], value: defaultValue, errors: [] }), payload);
    }

    return payload;
  }

  public async [Method.Every](payload: Payload.Every.ByHook<StoredValue>): Promise<Payload.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payload.Every.ByValue): Promise<Payload.Every.ByValue>;
  public async [Method.Every](payload: Payload.Every<StoredValue>): Promise<Payload.Every<StoredValue>> {
    await this.check();
    return payload;
  }

  public async [Method.Filter](payload: Payload.Filter.ByHook<StoredValue>): Promise<Payload.Filter.ByHook<StoredValue>>;
  public async [Method.Filter](payload: Payload.Filter.ByValue<StoredValue>): Promise<Payload.Filter.ByValue<StoredValue>>;
  public async [Method.Filter](payload: Payload.Filter<StoredValue>): Promise<Payload.Filter<StoredValue>> {
    await this.check();
    payload.data = {};

    if (isFilterByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of Object.entries(await this.db.getAll())) if (await hook(value, key)) payload.data[key] = value;
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of Object.entries(await this.db.getAll())) {
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
    await this.check();
    payload.data = [null, null];

    if (isFindByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of Object.entries(await this.db.getAll())) {
        const result = await hook(value, key);

        if (!result) continue;

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

      for (const [key, storedValue] of Object.entries(await this.db.getAll())) {
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

  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByHook<StoredValue, Value>): Promise<Payload.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByPath<Value>): Promise<Payload.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map<StoredValue, Value>): Promise<Payload.Map<StoredValue, Value>> {
    await this.check();
    payload.data = [];

    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of Object.entries(await this.db.getAll())) payload.data.push(await hook(value, key));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for (const value of Object.values(await this.db.getAll())) {
        const data = getProperty<Value>(value, path);

        if (data !== PROPERTY_NOT_FOUND) payload.data.push(data);
      }
    }

    return payload;
  }

  public async [Method.Partition](payload: Payload.Partition.ByHook<StoredValue>): Promise<Payload.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payload.Partition.ByValue<StoredValue>): Promise<Payload.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payload.Partition<StoredValue>): Promise<Payload.Partition<StoredValue>> {
    await this.check();
    return payload;
  }

  public async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove.ByHook<Value>): Promise<Payload.Remove.ByHook<Value>>;
  public async [Method.Remove](payload: Payload.Remove.ByValue): Promise<Payload.Remove.ByValue>;
  public async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove<Value>): Promise<Payload.Remove<Value>> {
    await this.check();
    return payload;
  }

  public async [Method.Some](payload: Payload.Some.ByHook<StoredValue>): Promise<Payload.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payload.Some.ByValue): Promise<Payload.Some.ByValue>;
  public async [Method.Some](payload: Payload.Some<StoredValue>): Promise<Payload.Some<StoredValue>> {
    await this.check();
    return payload;
  }

  public async [Method.Update]<Value = StoredValue>(payload: Payload.Update<StoredValue, Value>): Promise<Payload.Update<StoredValue, Value>> {
    await this.check();
    return payload;
  }

  protected fetchVersion() {
    return this.getMetadata('version');
  }

  private async check(key: string | null = null, type: string[] | null = null, path: string[] = []) {
    if (!this.db) throw new Error('Database has been closed');
    if (!key || !type) return;

    // I don't really know what exactly this check does.
    const value = await this.get({ method: Method.Get, key, path, errors: [] });

    if (value === null) {
      throw new Error(
        `The document "${key}" of path "${path}" was not found in the database`
        // 'JoshTypeError',
      );
    }

    const valueType = value.constructor.name;

    if (!type.includes(valueType)) {
      throw new Error(
        `The property ${path ? `${path} ` : ''}in key "${key}" is not of type "${type.join('" or "')}"(key was of type "${valueType}")`
        // 'JoshTypeError',
      );
    }
  }
}

export namespace IndexedDBProvider {
  export interface Options {}
}
