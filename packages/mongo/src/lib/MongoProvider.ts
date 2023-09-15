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
import { isNullOrUndefined, isPrimitive } from '@sapphire/utilities';
import { Serialize } from 'better-serialize';
import type { Collection, Document, Filter, MongoClientOptions } from 'mongodb';
import { MongoClient, ObjectId } from 'mongodb';
import { PROPERTY_NOT_FOUND, deleteProperty, getProperty, hasProperty, setProperty } from 'property-helpers';

/**
 * A provider that uses MongoDB as a database.
 * @since 2.0.0
 */
export class MongoProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: MongoProvider.Options;

  public migrations: JoshProvider.Migration[] = [
    {
      version: { major: 1, minor: 0, patch: 0 },
      run: async (context: JoshProvider.Context) => {
        const { collectionName = context.name, enforceCollectionName } = this.options;
        const collection = this.generateMongoDoc(enforceCollectionName ? collectionName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : collectionName);

        for await (const doc of collection.aggregate([{ $match: {} }])) {
          const { key, value, _id } = doc;
          const serialized = this.serialize(value);

          await collection.deleteOne({ _id });
          await collection.insertOne({ key, value: serialized });
        }

        await this.setMetadata('version', this.version);
      }
    }
  ];

  private connectionURI?: string;

  private _client?: MongoClient;

  private _collection?: Collection<MongoProvider.DocType<StoredValue>>;

  private _metadata?: Collection<MongoProvider.MetadataDocType>;

  public constructor(options?: MongoProvider.Options) {
    super(options);
  }

  public get version(): Semver {
    return process.env.NODE_ENV === 'test' ? { major: 2, minor: 0, patch: 0 } : resolveVersion('[VI]{{inject}}[/VI]');
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

  private get metadata(): Collection<MongoProvider.MetadataDocType> {
    if (isNullOrUndefined(this._metadata)) {
      throw this.error({
        message: 'Client is not connected, most likely due to `init` not being called or the server not being available',
        identifier: MongoProvider.Identifiers.NotConnected
      });
    }

    return this._metadata;
  }

  public override async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    const {
      collectionName = context.name,
      enforceCollectionName,
      authentication = MongoProvider.defaultAuthentication,
      connectOptions = {}
    } = this.options;

    if (typeof authentication === 'string') {
      this.connectionURI = authentication;
    } else {
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

  public [Method.AutoKey](payload: Payload.AutoKey): Payload.AutoKey {
    payload.data = new ObjectId().toString();

    return payload;
  }

  public async [Method.Clear](payload: Payload.Clear): Promise<Payload.Clear> {
    await this.collection.deleteMany({});
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

    await this[Method.Set]({ method: Method.Set, errors: [], key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payload.Delete): Promise<Payload.Delete> {
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

  public async [Method.DeleteMany](payload: Payload.DeleteMany): Promise<Payload.DeleteMany> {
    const { keys } = payload;

    await this.collection.deleteMany({ key: { $in: keys } });

    return payload;
  }

  public async [Method.Each](payload: Payload.Each<StoredValue>): Promise<Payload.Each<StoredValue>> {
    const { hook } = payload;

    for await (const { key, value } of this.iterate()) {
      await hook(this.deserialize(value), key);
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

    const docs = await this._getAll();

    for (const doc of docs) {
      payload.data[doc.key] = this.deserialize(doc.value);
    }

    return payload;
  }

  public async [Method.Every](payload: Payload.Every.ByHook<StoredValue>): Promise<Payload.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payload.Every.ByValue): Promise<Payload.Every.ByValue>;
  public async [Method.Every](payload: Payload.Every<StoredValue>): Promise<Payload.Every<StoredValue>> {
    payload.data = true;

    if ((await this[Method.Size]({ method: Method.Size, errors: [] })).data === 0) {
      return payload;
    }

    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { key, value } of this.iterate()) {
        const deserialized = this.deserialize(value);
        const result = await hook(deserialized, key);

        if (result) {
          continue;
        }

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

      for await (const { key, value } of this.iterate()) {
        const deserialized = this.deserialize(value);
        const filterValue = await hook(deserialized, key);

        if (!filterValue) {
          continue;
        }

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

        if (data === value) {
          payload.data[key] = deserialized;
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

      for await (const { key, value } of this.iterate()) {
        const deserialized = this.deserialize(value);
        const result = await hook(deserialized, key);

        if (!result) {
          continue;
        }

        payload.data = [key, deserialized];

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      for await (const { key, value: storedValue } of this.iterate()) {
        const deserialized = this.deserialize(storedValue);

        if (payload.data[0] !== null && payload.data[1] !== null) {
          break;
        }

        const data = getProperty(deserialized, path, false);

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

        payload.data = [key, deserialized];

        break;
      }
    }

    return payload;
  }

  public async [Method.Get]<StoredValue>(payload: Payload.Get<StoredValue>): Promise<Payload.Get<StoredValue>> {
    const { key, path } = payload;
    const doc = await this.collection.findOne({ key }, { projection: { value: 1 } });

    if (!doc) {
      return payload;
    }

    if (path.length === 0) {
      payload.data = this.deserialize(doc.value) as unknown as StoredValue;
    } else {
      const data = getProperty<StoredValue>(this.deserialize(doc.value), path);

      if (data !== PROPERTY_NOT_FOUND) {
        payload.data = data;
      }
    }

    return payload;
  }

  public async [Method.GetMany](payload: Payload.GetMany<StoredValue>): Promise<Payload.GetMany<StoredValue>> {
    payload.data = {};

    const { keys } = payload;
    const docs = await this.collection.find({ key: { $in: keys } }).toArray();

    for (const doc of docs) {
      payload.data[doc.key] = this.deserialize(doc.value);
    }

    return payload;
  }

  public async [Method.Has](payload: Payload.Has): Promise<Payload.Has> {
    const { key, path } = payload;
    let isThere = (await this.collection.countDocuments({ key })) !== 0;

    if (path.length !== 0 && isThere) {
      const value = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      isThere = hasProperty(value.data, path);
    }

    payload.data = isThere;

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
    const docs = await this._getAll({ key: 1 });

    payload.data = docs.map((doc) => doc.key);

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByHook<StoredValue, Value>): Promise<Payload.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByPath<Value>): Promise<Payload.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payload.Map<StoredValue, Value>): Promise<Payload.Map<StoredValue, Value>> {
    payload.data = [];

    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { key, value } of this.iterate()) {
        payload.data.push(await hook(this.deserialize(value), key));
      }
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for await (const { value } of this.iterate({ project: { value: 1 } })) {
        const deserialized = this.deserialize(value);
        const data = getProperty<Value>(deserialized, path);

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

      for await (const { key, value } of this.iterate()) {
        const deserialized = this.deserialize(value);
        const result = await hook(deserialized, key);

        if (result) {
          payload.data.truthy[key] = deserialized;
        } else {
          payload.data.falsy[key] = deserialized;
        }
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

        if (value === data) {
          payload.data.truthy[key] = deserialized;
        } else {
          payload.data.falsy[key] = deserialized;
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

  // Due to the use of $sample, the output will never have duplicates
  public async [Method.Random](payload: Payload.Random<StoredValue>): Promise<Payload.Random<StoredValue>> {
    const docCount = await this.collection.countDocuments({});

    if (docCount === 0) {
      return { ...payload, data: [] };
    }

    if (docCount < payload.count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.Random }));

      return payload;
    }

    const aggr: Document[] = [{ $sample: { size: payload.count } }];
    const docs = (await this.collection.aggregate(aggr).toArray()) || [];

    if (docs.length > 0) {
      payload.data = docs.map((doc) => this.deserialize(doc.value));
    }

    return payload;
  }

  public async [Method.RandomKey](payload: Payload.RandomKey): Promise<Payload.RandomKey> {
    const docCount = await this.collection.countDocuments({});

    if (docCount === 0) {
      return { ...payload, data: [] };
    }

    if (docCount < payload.count) {
      payload.errors.push(this.error({ identifier: CommonIdentifiers.InvalidCount, method: Method.RandomKey }));

      return payload;
    }

    const aggr: Document[] = [{ $sample: { size: payload.count } }];
    const docs = (await this.collection.aggregate(aggr).toArray()) || [];

    if (docs.length > 0) {
      payload.data = docs.map((doc) => doc.key);
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

    await this.collection.findOneAndUpdate(
      {
        key: { $eq: key }
      },
      {
        $set: { value: this.serialize(val as StoredValue) }
      },
      {
        upsert: true
      }
    );

    return payload;
  }

  public async [Method.SetMany](payload: Payload.SetMany): Promise<Payload.SetMany> {
    const { entries } = payload;
    const operations = [];

    for (const { key, path, value } of entries) {
      if (!payload.overwrite) {
        const found = (await this[Method.Has]({ method: Method.Has, errors: [], key, path })).data;

        if (found) {
          continue;
        }
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
              value: this.serialize(val as StoredValue)
            }
          }
        }
      });
    }

    if (operations.length > 0) {
      await this.collection.bulkWrite(operations);
    }

    return payload;
  }

  public async [Method.Size](payload: Payload.Size): Promise<Payload.Size> {
    payload.data = (await this.collection.countDocuments({})) ?? payload.data;

    return payload;
  }

  public async [Method.Some](payload: Payload.Some.ByHook<StoredValue>): Promise<Payload.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payload.Some.ByValue): Promise<Payload.Some.ByValue>;
  public async [Method.Some](payload: Payload.Some<StoredValue>): Promise<Payload.Some<StoredValue>> {
    payload.data = false;
    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for await (const { key, value } of this.iterate()) {
        const deserialized = this.deserialize(value);
        const someValue = await hook(deserialized, key);

        if (!someValue) {
          continue;
        }

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
      payload.errors.push(this.error({ identifier: CommonIdentifiers.MissingData, method: Method.Update }, { key, path: [] }));

      return payload;
    }

    const { data } = getPayload;

    await this[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: await hook(data, key) });

    return payload;
  }

  public async [Method.Values](payload: Payload.Values<StoredValue>): Promise<Payload.Values<StoredValue>> {
    const docs = await this._getAll({ value: 1 });

    payload.data = docs.map((doc) => this.deserialize(doc.value));

    return payload;
  }

  public async deleteMetadata(key: string): Promise<void> {
    await this.metadata.deleteOne({ key });
  }

  public async getMetadata<T = unknown>(key: string): Promise<T | undefined> {
    const doc = await this.metadata.findOne({ key });

    if (!doc) {
      return;
    }

    return doc.value as T;
  }

  public async setMetadata(key: string, value: unknown): Promise<void> {
    await this.metadata.findOneAndUpdate(
      {
        key: { $eq: key }
      },
      {
        $set: { value }
      },
      {
        upsert: true
      }
    );
  }

  protected async fetchVersion(): Promise<Semver> {
    const metadataVersion = await this.getMetadata<Semver>('version');

    if (metadataVersion) {
      return metadataVersion;
    }

    const docs = await this.collection.countDocuments();

    if (docs === 0) {
      await this.setMetadata('version', this.version);
      return this.version;
    }

    return { major: 1, minor: 0, patch: 0 };
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
    await this._collection.createIndex({ key: 'text' }, { unique: true });
    this._metadata = this.generateMongoDoc<MongoProvider.MetadataDocType>('metadata');
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

  private deserialize(value: Serialize.JsonCompatible | StoredValue): StoredValue {
    if (this.options.disableSerialization) {
      return value as StoredValue;
    }

    return Serialize.fromJsonCompatible(value as Serialize.JsonCompatible) as StoredValue;
  }

  private serialize(value: StoredValue) {
    if (this.options.disableSerialization) {
      return value;
    }

    return Serialize.toJsonCompatible(value) as Serialize.JsonCompatible;
  }

  private generateMongoDoc<T extends Document = MongoProvider.DocType<StoredValue>>(collectionName: string): Collection<T> {
    return this.client.db().collection(collectionName);
  }

  public static defaultAuthentication: MongoProvider.Authentication = { dbName: 'josh', host: 'localhost', port: 27017 };
}

export namespace MongoProvider {
  export interface Options extends JoshProvider.Options {
    /**
     * The collection name to use.
     * @since 2.0.0
     */
    collectionName?: string;

    /**
     * The connection options to use.
     * @since 2.0.0
     */
    connectOptions?: MongoClientOptions;

    /**
     * Whether to enforce the collection name for compatibility with MongoDB.
     * @since 2.0.0
     */
    enforceCollectionName?: boolean;

    /**
     * The authentication to use.
     * @since 2.0.0
     */
    authentication?: Partial<Authentication> | string;

    /**
     * Whether to disable serialization.
     * @since 2.0.0
     */
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

    value: Serialize.JsonCompatible | StoredValue;
  }

  export interface MetadataDocType extends Document {
    key: string;

    value: unknown;
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
