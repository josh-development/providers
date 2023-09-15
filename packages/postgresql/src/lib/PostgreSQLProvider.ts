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
import { Snowflake, TwitterSnowflake } from '@sapphire/snowflake';
import { isPrimitive } from '@sapphire/utilities';
import { PROPERTY_NOT_FOUND, deleteProperty, getProperty, hasProperty, setProperty } from 'property-helpers';
import { QueryHandler } from './QueryHandler';

export class PostgreSQLProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: PostgreSQLProvider.Options;

  public migrations: JoshProvider.Migration[] = [];

  private handler: QueryHandler<StoredValue>;

  private snowflake: Snowflake | typeof TwitterSnowflake;

  public constructor(options: PostgreSQLProvider.Options) {
    super(options);

    const { tableName = 'data', connectionDetails = PostgreSQLProvider.defaultConnectionDetails, epoch, disableSerialization } = options;

    this.snowflake = epoch === undefined ? TwitterSnowflake : new Snowflake(epoch);

    const { major, minor, patch } = this.version;

    if (typeof connectionDetails === 'string') {
      this.handler = new QueryHandler({ tableName, connectionDetails, version: `${major}.${minor}.${patch}` });
    } else {
      const { host, port, database, user, password } = {
        host: connectionDetails.host ?? PostgreSQLProvider.defaultConnectionDetails.host,
        port: connectionDetails.port ?? PostgreSQLProvider.defaultConnectionDetails.port,
        database: connectionDetails.database ?? PostgreSQLProvider.defaultConnectionDetails.database,
        user: connectionDetails.user ?? PostgreSQLProvider.defaultConnectionDetails.user,
        password: connectionDetails.password ?? PostgreSQLProvider.defaultConnectionDetails.password
      };

      this.handler = new QueryHandler({
        tableName,
        connectionDetails: { host, port, database, user, password },
        disableSerialization,
        version: `${major}.${minor}.${patch}`
      });
    }
  }

  public get version(): Semver {
    return process.env.NODE_ENV === 'test' ? { major: 1, minor: 0, patch: 0 } : resolveVersion('[VI]{{inject}}[/VI]');
  }

  public override async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    await this.handler.init();

    context = await super.init(context);

    return context;
  }

  public async deleteMetadata(key: string): Promise<void> {
    await this.handler.deleteMetadata(key);
  }

  public async getMetadata(key: string): Promise<unknown> {
    return this.handler.getMetadata(key);
  }

  public async setMetadata(key: string, value: unknown): Promise<void> {
    await this.handler.setMetadata(key, value);
  }

  public [Method.AutoKey](payload: Payload.AutoKey): Payload.AutoKey {
    payload.data = this.snowflake.generate().toString();

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
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Dec }, { key, path }));

      return payload;
    }

    await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payload.Delete): Promise<Payload.Delete> {
    const { key, path } = payload;

    if (path.length === 0) {
      await this.handler.delete(key);
    } else if ((await this[Method.Has]({ method: Method.Has, errors: [], key, path })).data) {
      const { data } = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      deleteProperty(data, path);
      await this.handler.set(key, data!);
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

    for (const key of await this.handler.keys()) {
      await hook((await this.handler.get(key))!, key);
    }

    return payload;
  }

  public async [Method.Ensure](payload: Payload.Ensure<StoredValue>): Promise<Payload.Ensure<StoredValue>> {
    const { key, defaultValue } = payload;

    payload.data = defaultValue;

    if ((await this[Method.Has]({ method: Method.Has, errors: [], key, path: [] })).data) {
      payload.data = await this.handler.get(key);
    } else {
      await this.handler.set(key, defaultValue);
    }

    return payload;
  }

  public async [Method.Entries](payload: Payload.Entries<StoredValue>): Promise<Payload.Entries<StoredValue>> {
    payload.data = (await this.handler.entries()).reduce((data, [key, value]) => ({ ...data, [key]: value }), {});

    return payload;
  }

  public async [Method.Every](payload: Payload.Every.ByHook<StoredValue>): Promise<Payload.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payload.Every.ByValue): Promise<Payload.Every.ByValue>;
  public async [Method.Every](payload: Payload.Every<StoredValue>): Promise<Payload.Every<StoredValue>> {
    payload.data = true;

    if ((await this.handler.size()) === 0) {
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
        payload.data = (await this.handler.get(key)) as unknown as Value;
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

    payload.data = (await this.handler.has(key)) && (path.length === 0 ? true : hasProperty(await this.handler.get(key), path));

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

    await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data });

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

        payload.data[result ? 'truthy' : 'falsy'][key] = value;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of await this.handler.entries()) {
        const data = getProperty(storedValue, path);

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

        payload.data[data === value ? 'truthy' : 'falsy'][key] = storedValue;
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
    const { count, duplicates } = payload;
    const size = await this.handler.size();

    if (size === 0) {
      return { ...payload, data: [] };
    }

    if (size < count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random }));

      return payload;
    }

    payload.data = [];

    const keys = await this.handler.keys();

    if (duplicates) {
      while (payload.data.length < count) {
        const key = keys[Math.floor(Math.random() * size)];

        payload.data.push((await this.handler.get(key))!);
      }
    } else {
      const randomKeys = new Set<string>();

      while (randomKeys.size < count) {
        randomKeys.add(keys[Math.floor(Math.random() * keys.length)]);
      }

      for (const key of randomKeys) {
        payload.data.push((await this.handler.get(key))!);
      }
    }

    return payload;
  }

  public async [Method.RandomKey](payload: Payload.RandomKey): Promise<Payload.RandomKey> {
    const { count, duplicates } = payload;
    const size = await this.handler.size();

    if (size === 0) {
      return { ...payload, data: [] };
    }

    if (size < count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.RandomKey }));

      return payload;
    }

    payload.data = [];

    const keys = await this.handler.keys();

    if (duplicates) {
      while (payload.data.length < count) {
        payload.data.push(keys[Math.floor(Math.random() * size)]);
      }
    } else {
      const randomKeys = new Set<string>();

      while (randomKeys.size < count) {
        randomKeys.add(keys[Math.floor(Math.random() * keys.length)]);
      }

      for (const key of randomKeys) {
        payload.data.push(key);
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

      await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data.filter((storedValue) => storedValue !== value) });
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
    const withPath = entries.filter((entry) => entry.path.length > 0);
    const withoutPath = entries.filter((entry) => entry.path.length === 0);

    for (const { key, path, value } of withPath) {
      if (overwrite) {
        await this[Method.Set]({ method: Method.Set, errors: [], key, path, value });
      } else if (!(await this[Method.Has]({ method: Method.Has, errors: [], key, path })).data) {
        await this[Method.Set]({ method: Method.Set, errors: [], key, path, value });
      }
    }

    if (withoutPath.length > 0) {
      await this.handler.setMany(
        withoutPath.map((entry) => [entry.key, entry.value as unknown as StoredValue]),
        overwrite
      );
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

  protected async fetchVersion() {
    const metadata = await this.handler.fetchMetadata();

    return resolveVersion(metadata.version);
  }

  public static defaultConnectionDetails: PostgreSQLProvider.ConnectionDetails = { host: 'localhost', port: 5432, user: 'postgres' };
}

export namespace PostgreSQLProvider {
  export interface Options extends JoshProvider.Options {
    tableName?: string;

    connectionDetails?: Partial<ConnectionDetails> | string;

    disableSerialization?: boolean;

    epoch?: number | bigint | Date;
  }

  export interface ConnectionDetails {
    host: string;

    port: number;

    database?: string;

    user?: string;

    password?: string;
  }
}
