import { CommonIdentifiers, JoshProvider, MathOperator, Method, Payloads } from '@joshdb/provider';
import { PROPERTY_NOT_FOUND, deleteProperty, getProperty, hasProperty, setProperty } from 'property-helpers';
import DbHandler from './DbHandler';

export class IndexedDBProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: IndexedDBProvider.Options;

  private db: DbHandler;
  public constructor(options: IndexedDBProvider.Options) {
    super(options);
    this.db = new DbHandler();
  }

  public async [Method.Each]<Value = StoredValue>(payload: Payloads.Each<Value>): Promise<Payloads.Each<Value>> {
    await this.check();

    const { hook } = payload;
    const data = await this.db.getAll();

    // @ts-expect-error 2322 Start making sense.
    Object.entries(data).forEach(([key, value]) => hook(value, key));

    return payload;
  }

  public async [Method.DeleteMany](payload: Payloads.DeleteMany): Promise<Payloads.DeleteMany> {
    await this.check();

    for (const key of payload.keys) {
      await this.db.delete(key);
    }

    return payload;
  }

  public async [Method.Delete](payload: Payloads.Delete): Promise<Payloads.Delete> {
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

  public async [Method.AutoKey](payload: Payloads.AutoKey): Promise<Payloads.AutoKey> {
    await this.check();

    payload.data = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    return payload;
  }

  public async [Method.Values]<Value = StoredValue>(payload: Payloads.Values<Value>): Promise<Payloads.Values<Value>> {
    await this.check();

    payload.data = Object.values(await this.db.getAll());

    return payload;
  }

  public async [Method.Math](payload: Payloads.Math): Promise<Payloads.Math> {
    await this.check();

    const { key, path, operator, operand } = payload;
    const getPayload = await this[Method.Get]<number>({ method: Method.Get, key, path });

    // @ts-expect-error 2532 No it's not
    if (getPayload.data === undefined || getPayload.data === PROPERTY_NOT_FOUND) {
      payload.error = this.error({ identifier: CommonIdentifiers.MissingData });
      return payload;
    }

    let { data } = getPayload;

    if (typeof data !== 'number') {
      payload.error = this.error({ identifier: CommonIdentifiers.InvalidDataType });
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

    await this[Method.Set]({ method: Method.Set, key, path, value: data });

    return payload;
  }

  public async [Method.Dec](payload: Payloads.Dec): Promise<Payloads.Dec> {
    await this.check();

    const { key, path } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, key, path });

    // @ts-expect-error 2532 No it's not
    if (getPayload.data === undefined || getPayload.data === PROPERTY_NOT_FOUND) {
      payload.error = this.error({ identifier: CommonIdentifiers.MissingData });
      return payload;
    }

    const { data } = getPayload;

    if (typeof data !== 'number') {
      payload.error = this.error({ identifier: CommonIdentifiers.InvalidDataType });
      return payload;
    }

    await this[Method.Set]({ method: Method.Set, key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Inc](payload: Payloads.Inc): Promise<Payloads.Inc> {
    await this.check();

    const { key, path } = payload;
    const getPayload = await this[Method.Get]({ method: Method.Get, key, path });

    // @ts-expect-error 2532 No it's not
    if (getPayload.data === undefined || getPayload.data === PROPERTY_NOT_FOUND) {
      payload.error = this.error({ identifier: CommonIdentifiers.MissingData });
      return payload;
    }

    const { data } = getPayload;

    if (typeof data !== 'number') {
      payload.error = this.error({ identifier: CommonIdentifiers.InvalidDataType });
      return payload;
    }

    await this[Method.Set]({ method: Method.Set, key, path, value: data + 1 });

    return payload;
  }

  public async [Method.Keys](payload: Payloads.Keys): Promise<Payloads.Keys> {
    await this.check();

    // @ts-expect-error 2532 Trust me bro
    payload.data = await this.db.getKeys();

    return payload;
  }

  public async [Method.RandomKey](payload: Payloads.RandomKey): Promise<Payloads.RandomKey> {
    await this.check();

    const keys = await this.db.getKeys();

    // @ts-expect-error 2532 Trust me bro
    if (keys.length !== 0) {
      // @ts-expect-error 2532 Trust me bro
      payload.data = [keys[Math.floor(Math.random() * keys.length)]];
    }

    return payload;
  }

  public async [Method.Random]<Value = StoredValue>(payload: Payloads.Random<Value>): Promise<Payloads.Random<Value>> {
    await this.check();

    // @ts-expect-error 2532 STFU
    const key = await this.randomKey(payload);

    if (key.data) {
      payload.data = await Promise.all(key.data.map((key) => this.db.get(key)));
    }

    return payload;
  }

  public async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    context = await super.init(context);
    await this.db.init();

    return context;
  }

  public async [Method.Get]<Value = StoredValue>(payload: Payloads.Get<Value>): Promise<Payloads.Get<Value>> {
    await this.check();

    const { key, path } = payload;
    const value = await this.db.get(key);

    payload.data = path.length === 0 ? value : getProperty(value, path);

    return payload;
  }

  public async [Method.Entries](payload: Payloads.Entries<StoredValue>): Promise<Payloads.Entries<StoredValue>> {
    await this.check();

    payload.data = await this.db.getAll();

    return payload;
  }

  public async [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Promise<Payloads.GetMany<StoredValue>> {
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

  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
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

  public async [Method.SetMany](payload: Payloads.SetMany): Promise<Payloads.SetMany> {
    await this.check();

    const { entries, overwrite } = payload;

    for (const entry of entries) {
      const [{ key, path }, value] = entry;
      const found = await this.get({ key, method: Method.Get, path });

      if (!found || (found && overwrite)) {
        await this.set({ key, value, path, method: Method.Set });
      }
    }

    return payload;
  }

  public async [Method.Clear](payload: Payloads.Clear): Promise<Payloads.Clear> {
    await this.check();
    await this.db.clear();

    return payload;
  }

  public async [Method.Has](payload: Payloads.Has): Promise<Payloads.Has> {
    await this.check();

    const { key, path } = payload;

    if (await this.db.has(key)) {
      payload.data = true;

      if (path.length !== 0) payload.data = hasProperty(await this.db.get(key), path);
    } else payload.data = false;

    return payload;
  }

  public async [Method.Size](payload: Payloads.Size): Promise<Payloads.Size> {
    await this.check();
    payload.data = await this.db.count();

    return payload;
  }

  public async [Method.Push]<Value = StoredValue>(payload: Payloads.Push<Value>): Promise<Payloads.Push<Value>> {
    await this.check();
    return payload;
  }

  public async [Method.Ensure]<Value = StoredValue>(payload: Payloads.Ensure<Value>): Promise<Payloads.Ensure<Value>> {
    await this.check();
    return payload;
  }

  public async [Method.Every](payload: Payloads.Every.ByHook<StoredValue>): Promise<Payloads.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  public async [Method.Every](payload: Payloads.Every<StoredValue>): Promise<Payloads.Every<StoredValue>> {
    await this.check();
    return payload;
  }

  public async [Method.Filter](payload: Payloads.Filter.ByHook<StoredValue>): Promise<Payloads.Filter.ByHook<StoredValue>>;
  public async [Method.Filter](payload: Payloads.Filter.ByValue<StoredValue>): Promise<Payloads.Filter.ByValue<StoredValue>>;
  public async [Method.Filter](payload: Payloads.Filter<StoredValue>): Promise<Payloads.Filter<StoredValue>> {
    await this.check();
    return payload;
  }

  public async [Method.Find](payload: Payloads.Find.ByHook<StoredValue>): Promise<Payloads.Find.ByHook<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find.ByValue<StoredValue>): Promise<Payloads.Find.ByValue<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find<StoredValue>): Promise<Payloads.Find<StoredValue>> {
    await this.check();
    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByHook<StoredValue, Value>): Promise<Payloads.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByPath<Value>): Promise<Payloads.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map<StoredValue, Value>): Promise<Payloads.Map<StoredValue, Value>> {
    await this.check();
    return payload;
  }

  public async [Method.Partition](payload: Payloads.Partition.ByHook<StoredValue>): Promise<Payloads.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition.ByValue<StoredValue>): Promise<Payloads.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition<StoredValue>): Promise<Payloads.Partition<StoredValue>> {
    await this.check();
    return payload;
  }

  public async [Method.Remove]<Value = StoredValue>(payload: Payloads.Remove.ByHook<Value>): Promise<Payloads.Remove.ByHook<Value>>;
  public async [Method.Remove](payload: Payloads.Remove.ByValue): Promise<Payloads.Remove.ByValue>;
  public async [Method.Remove]<Value = StoredValue>(payload: Payloads.Remove<Value>): Promise<Payloads.Remove<Value>> {
    await this.check();
    return payload;
  }

  public async [Method.Some](payload: Payloads.Some.ByHook<StoredValue>): Promise<Payloads.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payloads.Some.ByValue): Promise<Payloads.Some.ByValue>;
  public async [Method.Some](payload: Payloads.Some<StoredValue>): Promise<Payloads.Some<StoredValue>> {
    await this.check();
    return payload;
  }

  public async [Method.Update]<Value = StoredValue>(payload: Payloads.Update<StoredValue, Value>): Promise<Payloads.Update<StoredValue, Value>> {
    await this.check();
    return payload;
  }

  protected fetchVersion(context: JoshProvider.Context) {
    context;
    return this.resolveVersion('[VI]{version}[/VI]');
  }

  private async check(key: string | null = null, type: string[] | null = null, path: string[] = []) {
    if (!this.db) throw new Error('Database has been closed');
    if (!key || !type) return;

    const value = await this.get({ method: Method.Get, key, path });

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

  public get version(): JoshProvider.Semver {
    return this.resolveVersion('[VI]{version}[/VI]');
  }
}

export namespace IndexedDBProvider {
  export interface Options {}
}
