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
import { isNullOrUndefined, isPrimitive } from '@sapphire/utilities';
import { Collection, Document, Filter, MongoClient, MongoClientOptions, ObjectId } from 'mongodb';
import { deleteProperty, getProperty, hasProperty, PROPERTY_NOT_FOUND, setProperty } from 'property-helpers';

export class MongoProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: MongoProvider.Options;

  public migrations: JoshProvider.Migration[] = [
    {
      version: { major: 2, minor: 0, patch: 0 },
      run: async (context: JoshProvider.Context) => {
        const { collectionName = context.name, enforceCollectionName } = this.options;
        const collection = this.generateMongoDoc(enforceCollectionName ? collectionName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : collectionName);

        for await (const doc of collection.aggregate([{ $match: {} }])) {
          const { key, value, _id } = doc;

          await collection.insertOne({ key, value: this.serialize(value), version: this.version });
          await collection.deleteOne({ _id });
        }
      }
    }
  ];

  private connectionURI?: string;

  private _client?: MongoClient;

  private _collection?: Collection<MongoProvider.DocType<StoredValue>>;

  public constructor(options?: MongoProvider.Options) {
    super(options);
  }

  public get version(): JoshProvider.Semver {
    return this.resolveVersion('[VI]{version}[/VI]');
  }

  private get client(): MongoClient {
    if (isNullOrUndefined(this._client)) {
      throw this.error({
        message: 'Client is not connected, most likely due to `init` not being called or the server not being available',
        identifier: MongoProvider.Identifiers.NotConnected
      });
    }

    return this._client;
  }

  private get collection(): Collection<MongoProvider.DocType<StoredValue>> {
    if (isNullOrUndefined(this._collection)) {
      throw this.error({
        message: 'Client is not connected, most likely due to `init` not being called or the server not being available',
        identifier: MongoProvider.Identifiers.NotConnected
      });
    }

    return this._collection;
  }

  public async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    const {
      collectionName = context.name,
      enforceCollectionName,
      authentication = MongoProvider.defaultAuthentication,
      connectOptions = {}
    } = this.options;

    if (typeof collectionName === 'undefined') {
      throw this.error({
        message: 'A collection name must be provided if using this class without Josh.',
        identifier: MongoProvider.Identifiers.InitMissingCollectionName
      });
    }

    if (typeof authentication === 'string') this.connectionURI = authentication;
    else {
      const { user, password, dbName, host, port }: MongoProvider.Authentication = {
        user: authentication.user ?? MongoProvider.defaultAuthentication.user,
        password: authentication.password ?? MongoProvider.defaultAuthentication.password,
        dbName: authentication.dbName ?? MongoProvider.defaultAuthentication.dbName,
        host: authentication.host ?? MongoProvider.defaultAuthentication.host,
        port: authentication.port ?? MongoProvider.defaultAuthentication.port
      };

      this.connectionURI = `mongodb://${user?.length && password?.length ? `${user}:${password}@` : ''}${host}:${port}/${dbName}`;
    }

    await this.connect({ connectionURI: this.connectionURI, connectOptions, enforceCollectionName, collectionName });
    context = await super.init(context);
    return context;
  }

  public async close() {
    return this.client.close();
  }

  public [Method.AutoKey](payload: Payloads.AutoKey): Payloads.AutoKey {
    payload.data = new ObjectId().toString();

    return payload;
  }

  public async [Method.Clear](payload: Payloads.Clear): Promise<Payloads.Clear> {
    await this.collection.deleteMany({});
    return payload;
  }

  public async [Method.Dec](payload: Payloads.Dec): Promise<Payloads.Dec> {
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

    await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payloads.Delete): Promise<Payloads.Delete> {
    const { key, path } = payload;

    if (path.length === 0) {
      await this.collection.deleteOne({ key });

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

    await this.collection.deleteMany({ key: { $in: keys } });

    return payload;
  }

  public async [Method.Each](payload: Payloads.Each<StoredValue>): Promise<Payloads.Each<StoredValue>> {
    const { hook } = payload;

    for await (const { key, value } of this.iterate()) {
      await hook(this.deserialize(value), key);
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

    const docs = await this._getAll();

    for (const doc of docs) payload.data[doc.key] = this.deserialize(doc.value);

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
        const deserialized = this.deserialize(value);
        const result = await hook(deserialized, key);

        if (result) continue;

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const deserialized = this.deserialize(storedValue);
        const data = getProperty(deserialized, path);

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
        const deserialized = this.deserialize(value);
        const filterValue = await hook(deserialized, key);

        if (!filterValue) continue;

        payload.data[key] = deserialized;
      }
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const deserialized = this.deserialize(storedValue);
        const data = getProperty(deserialized, path);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Filter }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Filter }, { key, path, type: 'primitive' }));

          return payload;
        }

        if (data === value) payload.data[key] = deserialized;
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
        const deserialized = this.deserialize(value);
        const result = await hook(deserialized, key);

        if (!result) continue;

        payload.data = [key, deserialized];

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const deserialized = this.deserialize(storedValue);

        if (payload.data[0] !== null && payload.data[1] !== null) break;

        const data = getProperty(deserialized, path, false);

        if (data === PROPERTY_NOT_FOUND) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Find }, { key, path }));

          return payload;
        }

        if (!isPrimitive(data)) {
          payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidDataType, method: Method.Find }, { key, path, type: 'primitive' }));

          return payload;
        }

        if (data !== value) continue;

        payload.data = [key, deserialized];

        break;
      }
    }

    return payload;
  }

  public async [Method.Get]<StoredValue>(payload: Payloads.Get<StoredValue>): Promise<Payloads.Get<StoredValue>> {
    const { key, path } = payload;
    const doc = await this.collection.findOne({ key }, { projection: { value: 1 } });

    if (!doc) {
      return payload;
    }

    if (path.length === 0) {
      payload.data = this.deserialize(doc.value) as unknown as StoredValue;
    } else {
      const data = getProperty<StoredValue>(this.deserialize(doc.value), path);

      if (data !== PROPERTY_NOT_FOUND) payload.data = data;
    }

    return payload;
  }

  public async [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Promise<Payloads.GetMany<StoredValue>> {
    payload.data = {};

    const { keys } = payload;
    const docs = await this.collection.find({ key: { $in: keys } }).toArray();

    for (const doc of docs) payload.data[doc.key] = this.deserialize(doc.value);

    return payload;
  }

  public async [Method.Has](payload: Payloads.Has): Promise<Payloads.Has> {
    const { key, path } = payload;
    let isThere = (await this.collection.countDocuments({ key })) !== 0;

    if (path.length !== 0 && isThere) {
      const value = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      isThere = hasProperty(value.data, path);
    }

    payload.data = isThere;

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
    const docs = await this._getAll({ key: 1 });

    payload.data = docs.map((doc) => doc.key);

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByHook<StoredValue, Value>): Promise<Payloads.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByPath<Value>): Promise<Payloads.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map<StoredValue, Value>): Promise<Payloads.Map<StoredValue, Value>> {
    payload.data = [];

    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { key, value } of this.iterate()) payload.data.push(await hook(this.deserialize(value), key));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for await (const { value } of this.iterate({ project: { value: 1 } })) {
        const deserialized = this.deserialize(value);
        const data = getProperty<Value>(deserialized, path);

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
        const deserialized = this.deserialize(value);
        const result = await hook(deserialized, key);

        if (result) payload.data.truthy[key] = deserialized;
        else payload.data.falsy[key] = deserialized;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const deserialized = this.deserialize(storedValue);
        const data = getProperty<StoredValue>(deserialized, path);

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

        if (value === data) payload.data.truthy[key] = deserialized;
        else payload.data.falsy[key] = deserialized;
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

  // Due to the use of $sample, the output will never have duplicates
  public async [Method.Random](payload: Payloads.Random<StoredValue>): Promise<Payloads.Random<StoredValue>> {
    const docCount = await this.collection.countDocuments({});

    if (docCount === 0) return { ...payload, data: [] };
    if (docCount < payload.count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random }));

      return payload;
    }

    const aggr: Document[] = [{ $sample: { size: payload.count } }];
    const docs = (await this.collection.aggregate(aggr).toArray()) || [];

    if (docs.length > 0) payload.data = docs.map((doc) => this.deserialize(doc.value));

    return payload;
  }

  public async [Method.RandomKey](payload: Payloads.RandomKey): Promise<Payloads.RandomKey> {
    const docCount = await this.collection.countDocuments({});

    if (docCount === 0) return { ...payload, data: [] };
    if (docCount < payload.count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.RandomKey }));

      return payload;
    }

    const aggr: Document[] = [{ $sample: { size: payload.count } }];
    const docs = (await this.collection.aggregate(aggr).toArray()) || [];

    if (docs.length > 0) payload.data = docs.map((doc) => doc.key);

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

    await this.collection.findOneAndUpdate(
      {
        key: { $eq: key }
      },
      {
        $set: { value: this.serialize(val as StoredValue), version: this.version }
      },
      {
        upsert: true
      }
    );

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
        path.length > 0
          ? setProperty<StoredValue>((await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] })).data, path, value)
          : value;

      operations.push({
        updateOne: {
          filter: { key },
          upsert: true,
          update: {
            $set: {
              value: this.serialize(val as StoredValue),
              version: this.version
            }
          }
        }
      });
    }

    if (operations.length > 0) await this.collection.bulkWrite(operations);

    return payload;
  }

  public async [Method.Size](payload: Payloads.Size): Promise<Payloads.Size> {
    payload.data = (await this.collection.countDocuments({})) ?? payload.data;

    return payload;
  }

  public async [Method.Some](payload: Payloads.Some.ByHook<StoredValue>): Promise<Payloads.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payloads.Some.ByValue): Promise<Payloads.Some.ByValue>;
  public async [Method.Some](payload: Payloads.Some<StoredValue>): Promise<Payloads.Some<StoredValue>> {
    payload.data = false;
    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { key, value } of this.iterate()) {
        const deserialized = this.deserialize(value);
        const someValue = await hook(deserialized, key);

        if (!someValue) continue;

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const deserialized = this.deserialize(storedValue);
        const data = getProperty(deserialized, path);

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
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Update }, { key, path: [] }));

      return payload;
    }

    const { data } = getPayload;

    await this[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: await hook(data, key) });

    return payload;
  }

  public async [Method.Values](payload: Payloads.Values<StoredValue>): Promise<Payloads.Values<StoredValue>> {
    const docs = await this._getAll({ value: 1 });

    payload.data = docs.map((doc) => this.deserialize(doc.value));

    return payload;
  }

  protected async fetchVersion(): Promise<JoshProvider.Semver> {
    const doc = await this.collection.findOne({}, { projection: { version: 1 } });

    if (!doc) return this.version;
    return doc && doc.version ? doc.version : { major: 1, minor: 0, patch: 0 };
  }

  private async connect({
    connectionURI,
    connectOptions,
    enforceCollectionName,
    collectionName
  }: {
    connectionURI: string;
    connectOptions?: MongoClientOptions;
    enforceCollectionName?: boolean;
    collectionName: string;
  }): Promise<void> {
    const client = new MongoClient(connectionURI, connectOptions);

    this._client = await client.connect();
    this._collection = this.generateMongoDoc(enforceCollectionName ? collectionName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : collectionName);
  }

  private _getAll(projection: { [key: string]: 1 | 0 } = { key: 1, value: 1 }) {
    return this.collection.find<MongoProvider.DocType<StoredValue>>({}, { projection }).toArray();
  }

  private async *iterate(options: MongoProvider.IterateOptions = {}): AsyncIterableIterator<MongoProvider.DocType<StoredValue>> {
    const { filter = {}, project = { key: 1, value: 1 } } = options;

    for await (const document of this.collection.aggregate<MongoProvider.DocType<StoredValue>>([{ $match: filter }, { $project: project }])) {
      yield document;
    }
  }

  private deserialize(value: Serialize.JSON | StoredValue): StoredValue {
    if (this.options.disableSerialization) return value as StoredValue;
    return Serialize.fromJSON(value as Serialize.JSON) as StoredValue;
  }

  private serialize(value: StoredValue) {
    if (this.options.disableSerialization) return value;
    return Serialize.toJSON(value) as Serialize.JSON;
  }

  private generateMongoDoc<StoredValue>(collectionName: string): Collection<MongoProvider.DocType<StoredValue>> {
    return this.client.db().collection(collectionName);
  }

  public static defaultAuthentication: MongoProvider.Authentication = { dbName: 'josh', host: 'localhost', port: 27017 };
}

export namespace MongoProvider {
  export interface Options extends JoshProvider.Options {
    collectionName?: string;

    connectOptions?: MongoClientOptions;

    enforceCollectionName?: boolean;

    authentication?: Partial<Authentication> | string;

    disableSerialization?: boolean;
  }

  export interface Authentication {
    user?: string;

    password?: string;

    dbName: string;

    port: number;

    host: string;
  }

  export interface DocType<StoredValue> extends Document {
    key: string;

    value: Serialize.JSON | StoredValue;

    version: JoshProvider.Semver;
  }

  export interface IterateOptions<StoredValue = unknown> {
    filter?: Filter<DocType<StoredValue>>;

    project?: Partial<Record<'key' | 'value' | 'version', 0 | 1>>;
  }

  export enum Identifiers {
    InitMissingCollectionName = 'initMissingCollectionName',

    NotConnected = 'notConnected'
  }
}
