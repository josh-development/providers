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
import { Serialize } from '@joshdb/serialize';
import { isPrimitive } from '@sapphire/utilities';
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deleteProperty, getProperty, hasProperty, PROPERTY_NOT_FOUND, setProperty } from 'property-helpers';
import { QueryHandler } from './QueryHandler';

export class SQLiteProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: SQLiteProvider.Options;

  public migrations: JoshProvider.Migration[] = [
    {
      version: { major: 1, minor: 0, patch: 0 },
      run: (context: JoshProvider.Context) => {
        const { tableName = context.name, dataDirectory, persistent, disableSerialization } = this.options;

        if (persistent && existsSync(resolve(dataDirectory, `${tableName}.sqlite`))) {
          const database = new Database(resolve(dataDirectory, `${tableName}.sqlite`));
          const entries = database.prepare(`SELECT * FROM '${tableName}' WHERE path = '::NULL::'`).all() as Record<'key' | 'value', string>[];

          database.prepare(`DROP TABLE '${tableName}'`).run();

          database.prepare(`CREATE TABLE '${tableName}' (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();

          if (entries.length !== 0) {
            database
              .prepare(`INSERT INTO '${tableName}' (key, value) VALUES ${entries.map(() => '(?, ?)').join(', ')}`)
              .run(...entries.flatMap((entry) => [entry.key, JSON.stringify(disableSerialization ? entry.value : Serialize.toJSON(entry.value))]));
          }

          const autoNum = database.prepare(`SELECT lastnum FROM 'internal::autonum' WHERE josh = '${tableName}'`).get() as
            | Pick<LegacyAutoNumRow, 'lastnum'>
            | undefined;

          if (autoNum?.lastnum) {
            database
              .prepare(
                `CREATE TABLE IF NOT EXISTS 'internal_metadata' (name TEXT PRIMARY KEY, version TEXT NOT NULL, autoKeyCount INTEGER, serializedKeys TEXT)`
              )
              .run();

            const { major, minor, patch } = this.version;

            database
              .prepare<QueryHandler.MetadataRow>(
                `INSERT INTO 'internal_metadata' (name, version, autoKeyCount, serializedKeys) VALUES (@name, @version, @autoKeyCount, @serializedKeys)`
              )
              .run({
                name: tableName,
                version: `${major}.${minor}.${patch}`,
                autoKeyCount: autoNum.lastnum,
                serializedKeys: JSON.stringify(disableSerialization ? [] : entries.map((entry) => entry.key))
              });
          }

          database.prepare(`DELETE FROM 'internal::autonum' WHERE josh = '${tableName}'`).run();

          database.close();
        }
      }
    }
  ];

  private _handler?: QueryHandler<StoredValue>;

  public constructor(options: Partial<SQLiteProvider.Options>) {
    super(options);

    this.options = {
      ...this.options,
      dataDirectory: this.options.useAbsolutePath
        ? resolve(this.options.dataDirectory ?? 'data')
        : resolve(process.cwd(), this.options.dataDirectory ?? 'data'),
      wal: this.options.wal ?? true,
      persistent: this.options.persistent ?? true,
      disableSerialization: this.options.disableSerialization ?? false
    };
  }

  public get version(): JoshProvider.Semver {
    return process.env.NODE_ENV === 'test' ? { major: 2, minor: 0, patch: 0 } : this.resolveVersion('[VI]{version}[/VI]');
  }

  private get handler(): QueryHandler<StoredValue> {
    if (this._handler instanceof QueryHandler) return this._handler;

    throw this.error(SQLiteProvider.Identifiers.HandlerNotFound);
  }

  public async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    context = await super.init(context);

    this.options.tableName = this.options.tableName ?? context.name;

    const { tableName, dataDirectory, wal, persistent, disableSerialization } = this.options;

    if (persistent && !existsSync(dataDirectory)) await mkdir(dataDirectory, { recursive: true });

    const database = persistent ? new Database(resolve(dataDirectory, `${tableName}.sqlite`)) : new Database(':memory:');
    const { major, minor, patch } = this.version;

    this._handler = new QueryHandler({ database, tableName, wal, version: `${major}.${minor}.${patch}`, disableSerialization });

    return context;
  }

  public [Method.AutoKey](payload: Payloads.AutoKey): Payloads.AutoKey {
    payload.data = this.handler.autoKey();

    return payload;
  }

  public [Method.Clear](payload: Payloads.Clear): Payloads.Clear {
    this.handler.clear();

    return payload;
  }

  public [Method.Dec](payload: Payloads.Dec): Payloads.Dec {
    const { key, path } = payload;
    const getPayload = this[Method.Get]({ method: Method.Get, errors: [], key, path });

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

  public [Method.Delete](payload: Payloads.Delete): Payloads.Delete {
    const { key, path } = payload;

    if (path.length === 0) this.handler.delete(key);
    else if (this[Method.Has]({ method: Method.Has, errors: [], key, path }).data) {
      const { data } = this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      deleteProperty(data, path);
      this.handler.set(key, data);
    }

    return payload;
  }

  public [Method.DeleteMany](payload: Payloads.DeleteMany): Payloads.DeleteMany {
    const { keys } = payload;

    this.handler.deleteMany(keys);

    return payload;
  }

  public async [Method.Each](payload: Payloads.Each<StoredValue>): Promise<Payloads.Each<StoredValue>> {
    const { hook } = payload;

    for (const key of this.handler.keys()) await hook(this.handler.get(key)!, key);

    return payload;
  }

  public [Method.Ensure](payload: Payloads.Ensure<StoredValue>): Payloads.Ensure<StoredValue> {
    const { key, defaultValue } = payload;

    payload.data = defaultValue;

    if (this[Method.Has]({ method: Method.Has, errors: [], key, path: [] }).data) payload.data = this.handler.get(key);
    else this.handler.set(key, defaultValue);

    return payload;
  }

  public [Method.Entries](payload: Payloads.Entries<StoredValue>): Payloads.Entries<StoredValue> {
    payload.data = this.handler.entries().reduce((data, [key, value]) => ({ ...data, [key]: value }), {});

    return payload;
  }

  public async [Method.Every](payload: Payloads.Every.ByHook<StoredValue>): Promise<Payloads.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  public async [Method.Every](payload: Payloads.Every<StoredValue>): Promise<Payloads.Every<StoredValue>> {
    payload.data = true;

    if (this.handler.size() === 0) return payload;
    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of this.handler.entries()) {
        const result = await hook(value, key);

        if (result) continue;

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of this.handler.entries()) {
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

      for (const [key, value] of this.handler.entries()) if (await hook(value, key)) payload.data[key] = value;
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of this.handler.entries()) {
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

      for (const [key, value] of this.handler.entries()) {
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

      for (const [key, storedValue] of this.handler.entries()) {
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

  public [Method.Get]<Value = StoredValue>(payload: Payloads.Get<Value>): Payloads.Get<Value> {
    const { key, path } = payload;

    if (path.length === 0) {
      if (this.handler.has(key)) payload.data = this.handler.get(key) as unknown as Value;
    } else {
      const data = getProperty<Value>(this.handler.get(key), path);

      if (data !== PROPERTY_NOT_FOUND) payload.data = data;
    }

    return payload;
  }

  public [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Payloads.GetMany<StoredValue> {
    const { keys } = payload;

    payload.data = this.handler.getMany(keys);

    return payload;
  }

  public [Method.Has](payload: Payloads.Has): Payloads.Has {
    payload.data = this.handler.has(payload.key) && hasProperty(this.handler.get(payload.key), payload.path);

    return payload;
  }

  public [Method.Inc](payload: Payloads.Inc): Payloads.Inc {
    const { key, path } = payload;
    const getPayload = this[Method.Get]({ method: Method.Get, errors: [], key, path });

    if (!isPayloadWithData(getPayload)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Inc }, { key, path }));

      return payload;
    }

    const { data } = getPayload;

    if (typeof data !== 'number') {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Inc }, { key, path, type: 'number' }));

      return payload;
    }

    this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data + 1 });

    return payload;
  }

  public [Method.Keys](payload: Payloads.Keys): Payloads.Keys {
    payload.data = this.handler.keys();

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByHook<StoredValue, Value>): Promise<Payloads.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByPath<Value>): Promise<Payloads.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map<StoredValue, Value>): Promise<Payloads.Map<StoredValue, Value>> {
    payload.data = [];

    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of this.handler.entries()) payload.data.push(await hook(value, key));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for (const value of this.handler.values()) {
        const data = getProperty<Value>(value, path);

        if (data !== PROPERTY_NOT_FOUND) payload.data.push(data);
      }
    }

    return payload;
  }

  public [Method.Math](payload: Payloads.Math): Payloads.Math {
    const { key, path, operator, operand } = payload;
    const getPayload = this[Method.Get]<number>({ method: Method.Get, errors: [], key, path });

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

  public async [Method.Partition](payload: Payloads.Partition.ByHook<StoredValue>): Promise<Payloads.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition.ByValue<StoredValue>): Promise<Payloads.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition<StoredValue>): Promise<Payloads.Partition<StoredValue>> {
    payload.data = { truthy: {}, falsy: {} };

    if (isPartitionByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of this.handler.entries()) {
        const result = await hook(value, key);

        payload.data[result ? 'truthy' : 'falsy'][key] = value;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of this.handler.entries()) {
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

  public [Method.Push]<Value = StoredValue>(payload: Payloads.Push<Value>): Payloads.Push<Value> {
    const { key, path, value } = payload;
    const getPayload = this[Method.Get]({ method: Method.Get, errors: [], key, path });

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
    this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data });

    return payload;
  }

  public [Method.Random](payload: Payloads.Random<StoredValue>): Payloads.Random<StoredValue> {
    const { count, duplicates } = payload;
    const size = this.handler.size();

    if (size === 0) return { ...payload, data: [] };
    if (size < count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random }, { size }));

      return payload;
    }

    payload.data = [];

    const keys = this.handler.keys();

    if (duplicates) {
      while (payload.data.length < count) {
        const key = keys[Math.floor(Math.random() * size)];

        payload.data.push(this.handler.get(key)!);
      }
    } else {
      const randomKeys = new Set<string>();

      while (randomKeys.size < count) randomKeys.add(keys[Math.floor(Math.random() * keys.length)]);

      for (const key of randomKeys) payload.data.push(this.handler.get(key)!);
    }

    return payload;
  }

  public [Method.RandomKey](payload: Payloads.RandomKey): Payloads.RandomKey {
    const { count, duplicates } = payload;
    const size = this.handler.size();

    if (size === 0) return { ...payload, data: [] };
    if (size < count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.RandomKey }, { size }));

      return payload;
    }

    payload.data = [];

    const keys = this.handler.keys();

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
      const getPayload = this[Method.Get]<Value[]>({ method: Method.Get, errors: [], key, path });

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

      this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data.filter((_, index) => !filterValues[index]) });
    }

    if (isRemoveByValuePayload(payload)) {
      const { key, path, value } = payload;
      const getPayload = this[Method.Get]({ method: Method.Get, errors: [], key, path });

      if (!isPayloadWithData(getPayload)) {
        payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Remove }, { key, path }));

        return payload;
      }

      const { data } = getPayload;

      if (!Array.isArray(data)) {
        payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Remove }, { key, path, type: 'array' }));

        return payload;
      }

      this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data.filter((storedValue) => storedValue !== value) });
    }

    return payload;
  }

  public [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Payloads.Set<Value> {
    const { key, path, value } = payload;

    if (path.length === 0) this.handler.set(key, value as unknown as StoredValue);
    else {
      const storedValue = this.handler.get(key);

      this.handler.set(key, setProperty(storedValue, path, value));
    }

    return payload;
  }

  public [Method.SetMany](payload: Payloads.SetMany): Payloads.SetMany {
    const { entries, overwrite } = payload;
    const withPath = entries.filter((entry) => entry.path.length > 0);
    const withoutPath = entries.filter((entry) => entry.path.length === 0);

    for (const { key, path, value } of withPath) {
      if (overwrite) this[Method.Set]({ method: Method.Set, errors: [], key, path, value });
      else if (!this[Method.Has]({ method: Method.Has, errors: [], key, path }).data) {
        this[Method.Set]({ method: Method.Set, errors: [], key, path, value });
      }
    }

    if (withoutPath.length > 0) {
      this.handler.setMany(
        withoutPath.map((entry) => [entry.key, entry.value as StoredValue]),
        overwrite
      );
    }

    return payload;
  }

  public [Method.Size](payload: Payloads.Size): Payloads.Size {
    payload.data = this.handler.size();

    return payload;
  }

  public async [Method.Some](payload: Payloads.Some.ByHook<StoredValue>): Promise<Payloads.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payloads.Some.ByValue): Promise<Payloads.Some.ByValue>;
  public async [Method.Some](payload: Payloads.Some<StoredValue>): Promise<Payloads.Some<StoredValue>> {
    payload.data = false;

    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of this.handler.entries()) {
        const result = await hook(value, key);

        if (!result) continue;

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [key, storedValue] of this.handler.entries()) {
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
    const getPayload = this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData<StoredValue>(getPayload)) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Update }, { key }));

      return payload;
    }

    const { data } = getPayload;

    this[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: await hook(data, key) });

    return payload;
  }

  public [Method.Values](payload: Payloads.Values<StoredValue>): Payloads.Values<StoredValue> {
    payload.data = this.handler.values();

    return payload;
  }

  protected resolveIdentifier(identifier: string, metadata: Record<string, unknown>): string {
    try {
      return super.resolveIdentifier(identifier, metadata);
    } catch {
      switch (identifier) {
        case SQLiteProvider.Identifiers.HandlerNotFound:
          return 'The "QueryHandler" was not found for this provider. This usually means the "init()" method was not invoked.';
      }

      throw new Error(`Unknown identifier: ${identifier}`);
    }
  }

  protected fetchVersion(context: JoshProvider.Context) {
    const { tableName = context.name, dataDirectory, persistent } = this.options;

    if (!persistent) return this.version;
    if (!existsSync(resolve(dataDirectory, `${tableName}.sqlite`))) return this.version;

    const database = new Database(resolve(dataDirectory, `${tableName}.sqlite`), { fileMustExist: true });

    if (!(database.pragma(`table_info(${tableName})`) as TableInfo[]).some((info) => info.name === 'version')) {
      return { major: 1, minor: 0, patch: 0 };
    }

    const table = database.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = 'internal::autonum'`).get();

    if (table !== undefined) return { major: 1, minor: 0, patch: 0 };

    const row = database.prepare(`SELECT version FROM 'internal_metadata' WHERE name = '${tableName}'`).get() as
      | Pick<QueryHandler.MetadataRow, 'version'>
      | undefined;

    database.close();

    if (row === undefined) return this.version;

    return this.resolveVersion(row.version);
  }
}

export namespace SQLiteProvider {
  export interface Options extends JoshProvider.Options {
    tableName: string;

    useAbsolutePath?: boolean;

    dataDirectory: string;

    wal: boolean;

    persistent: boolean;

    disableSerialization: boolean;
  }

  export enum Identifiers {
    HandlerNotFound = 'handlerNotFound'
  }
}

interface TableInfo {
  cid: number;

  name: string;

  type: string;

  notnull: number;

  dflt_value: string | null;

  pk: number;
}

interface LegacyAutoNumRow {
  josh: string;

  lastnum: number;
}
