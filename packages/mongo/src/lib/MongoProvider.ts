import {
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
  isRemoveByHookPayload,
  isRemoveByValuePayload,
  isSomeByHookPayload,
  isSomeByValuePayload,
  JoshProvider,
  MathOperator,
  Method,
  Payloads
} from '@joshdb/core';
import { Serialize } from '@joshdb/serialize';
import { deleteFromObject, getFromObject, hasFromObject, setToObject } from '@realware/utilities';
import { isNullOrUndefined, isNumber, isPrimitive } from '@sapphire/utilities';
import { connect, ConnectOptions, Model, model, Mongoose, PipelineStage, Schema, Types } from 'mongoose';
export class MongoProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: MongoProvider.Options;

  private connectionURI?: string;

  private _client?: Mongoose;

  private _collection?: Model<MongoProvider.DocType>;

  public constructor(options: MongoProvider.Options) {
    super(options);
  }

  public async init(context: JoshProvider.Context<StoredValue>): Promise<JoshProvider.Context<StoredValue>> {
    context = await super.init(context);

    const {
      collectionName = context.name,
      enforceCollectionName,
      authentication = MongoProvider.defaultAuthentication,
      connectOptions = {}
    } = this.options;

    if (collectionName === undefined)
      throw this.error({
        message: 'A collection name must be provided if using this class without Josh.',
        identifier: MongoProvider.Identifiers.InitMissingCollectionName
      });

    this._collection = MongoProvider.generateMongoDoc(
      enforceCollectionName ? collectionName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : collectionName
    );

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

    this._client = await connect(this.connectionURI, connectOptions);

    return context;
  }

  public async close() {
    return this.client.disconnect();
  }

  public [Method.AutoKey](payload: Payloads.AutoKey): Payloads.AutoKey {
    payload.data = new Types.ObjectId().toString();

    return payload;
  }

  public async [Method.Clear](payload: Payloads.Clear): Promise<Payloads.Clear> {
    await this.collection.deleteMany({});

    return payload;
  }

  public async [Method.Dec](payload: Payloads.Dec): Promise<Payloads.Dec> {
    const { key, path } = payload;
    const { data } = await this.get<StoredValue>({ key, method: Method.Get, path });

    if (data === undefined) {
      payload.error = this.error({
        identifier: MongoProvider.CommonIdentifiers.DecMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Dec
      });

      return payload;
    }

    if (!isNumber(data)) {
      payload.error = this.error({
        identifier: MongoProvider.CommonIdentifiers.DecInvalidType,
        message:
          path.length === 0 ? `The data at "${key}" must be of type "number".` : `The data at "${key}.${path.join('.')}" must be of type "number".`,
        method: Method.Dec
      });

      return payload;
    }

    await this.set({ method: Method.Set, key, path, value: data - 1 });

    return payload;
  }

  public async [Method.Delete](payload: Payloads.Delete): Promise<Payloads.Delete> {
    const { key, path } = payload;

    if (path.length === 0) {
      await this.collection.deleteOne({ key });

      return payload;
    }

    if ((await this.has({ method: Method.Has, key, path, data: false })).data) {
      const { data } = await this.get({ method: Method.Get, key, path: [] });

      deleteFromObject(data, path);

      await this.set({ method: Method.Set, key, path: [], value: data });

      return payload;
    }

    return payload;
  }

  public async [Method.DeleteMany](payload: Payloads.DeleteMany): Promise<Payloads.DeleteMany> {
    const { keys } = payload;

    await this.collection.deleteMany({ key: { $in: keys } });

    return payload;
  }

  public async [Method.Ensure](payload: Payloads.Ensure<StoredValue>): Promise<Payloads.Ensure<StoredValue>> {
    const { key } = payload;

    if (!(await this.has({ key, method: Method.Has, data: false, path: [] })).data)
      await this.set({ key, value: payload.defaultValue, method: Method.Set, path: [] });

    payload.data = (await this.get({ key, method: Method.Get, path: [] })).data as StoredValue;

    return payload;
  }

  public async [Method.Every](payload: Payloads.Every.ByHook<StoredValue>): Promise<Payloads.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  public async [Method.Every](payload: Payloads.Every<StoredValue>): Promise<Payloads.Every<StoredValue>> {
    if ((await this.size({ method: Method.Size, data: 0 })).data === 0) {
      payload.data = true;

      return payload;
    }
    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of (await this.values({ method: Method.Values, data: [] })).data || []) {
        const everyValue = await hook(value);

        if (everyValue) continue;

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;

      for (const [_key, data] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data || {})) {
        if (value === getFromObject(data, path)) continue;

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

      for (const [key, value] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data || {})) {
        const filterValue = await hook(value);

        if (!filterValue) continue;

        payload.data[key] = value;
      }
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = this.error({
          identifier: MongoProvider.CommonIdentifiers.FilterInvalidValue,
          message: 'The "value" must be a primitive type.',
          method: Method.Filter
        });

        return payload;
      }

      for (const [key, storedValue] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data || {}))
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data[key] = storedValue;
    }

    return payload;
  }

  public async [Method.Find](payload: Payloads.Find.ByHook<StoredValue>): Promise<Payloads.Find.ByHook<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find.ByValue<StoredValue>): Promise<Payloads.Find.ByValue<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find<StoredValue>): Promise<Payloads.Find<StoredValue>> {
    if (isFindByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, storedValue] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data || {})) {
        const foundValue = await hook(storedValue);

        if (!foundValue) continue;

        payload.data = [key, storedValue];

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = this.error({
          identifier: MongoProvider.CommonIdentifiers.FindInvalidValue,
          message: 'The "value" must be of type primitive.',
          method: Method.Find
        });

        return payload;
      }

      for (const [key, storedValue] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data || {})) {
        if (payload.data !== undefined) break;
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data = [key, storedValue];
      }
    }

    return payload;
  }

  public async [Method.Get]<StoredValue>(payload: Payloads.Get<StoredValue>): Promise<Payloads.Get<StoredValue>> {
    const { key, path } = payload;

    const doc = await this.collection.findOne({ key }, { value: 1 });

    if (!doc) {
      payload.data = undefined;

      return payload;
    }

    Reflect.set(payload, 'data', this.options.disableSerialization ? doc.value : this.deserialize(doc.value));

    if (path.length > 0) payload.data = getFromObject(payload.data, path);

    return payload;
  }

  public async [Method.GetAll](payload: Payloads.GetAll<StoredValue>): Promise<Payloads.GetAll<StoredValue>> {
    payload.data = {};

    const docs = (await this.collection.find({})) || [];

    for (const doc of docs) payload.data[doc.key] = this.options.disableSerialization ? doc.value : this.deserialize(doc.value);

    return payload;
  }

  public async [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Promise<Payloads.GetMany<StoredValue>> {
    payload.data = {};

    const { keys } = payload;

    const docs = (await this.collection.find({ key: { $in: keys } })) || [];

    for (const doc of docs) payload.data[doc.key] = this.options.disableSerialization ? doc.value : this.deserialize(doc.value);

    return payload;
  }

  public async [Method.Has](payload: Payloads.Has): Promise<Payloads.Has> {
    const { key, path } = payload;
    let isThere = (await this.collection.exists({ key })) !== null;

    if (path.length !== 0 && isThere) {
      const value = await this.get({ method: Method.Get, key, path: [] });

      isThere = hasFromObject(value.data, path);
    }

    payload.data = isThere;

    return payload;
  }

  public async [Method.Inc](payload: Payloads.Inc): Promise<Payloads.Inc> {
    const { key, path } = payload;
    const { data } = await this.get<StoredValue>({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = this.error({
        identifier: MongoProvider.CommonIdentifiers.IncMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Inc
      });

      return payload;
    }
    if (!isNumber(data)) {
      payload.error = this.error({
        identifier: MongoProvider.CommonIdentifiers.IncInvalidType,
        message:
          path.length === 0 ? `The data at "${key}" must be of type "number".` : `The data at "${key}.${path.join('.')}" must be of type "number".`,
        method: Method.Inc
      });

      return payload;
    }

    await this.set({ method: Method.Set, key, path, value: data + 1 });

    return payload;
  }

  public async [Method.Keys](payload: Payloads.Keys): Promise<Payloads.Keys> {
    const docs = (await this.collection.find({}, { key: 1 })) || [];

    payload.data = docs.map((doc) => doc.key);

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByHook<StoredValue, Value>): Promise<Payloads.Map.ByHook<StoredValue, Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByPath<Value>): Promise<Payloads.Map.ByPath<Value>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map<StoredValue, Value>): Promise<Payloads.Map<StoredValue, Value>> {
    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      // @ts-expect-error 2345
      for (const value of (await this.values({ method: Method.Values, data: [] })).data) payload.data.push(await hook(value));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      payload.data = [];

      for (const value of (await this.values({ method: Method.Values, data: [] })).data || [])
        payload.data.push((path.length === 0 ? value : getFromObject(value, path)) as Value);
    }

    return payload;
  }

  public async [Method.Math](payload: Payloads.Math): Promise<Payloads.Math> {
    const { key, path, operator, operand } = payload;
    let { data } = await this.get<number>({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = this.error({
        identifier: MongoProvider.CommonIdentifiers.MathMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Math
      });

      return payload;
    }

    if (!isNumber(data)) {
      payload.error = this.error({
        identifier: MongoProvider.CommonIdentifiers.MathInvalidType,
        message: path.length === 0 ? `The data at "${key}" must be a number.` : `The data at "${key}.${path.join('.')}" must be a number.`,
        method: Method.Math
      });

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

    await this.set({ method: Method.Set, key, path, value: data });

    return payload;
  }

  public async [Method.Partition](payload: Payloads.Partition.ByHook<StoredValue>): Promise<Payloads.Partition.ByHook<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition.ByValue<StoredValue>): Promise<Payloads.Partition.ByValue<StoredValue>>;
  public async [Method.Partition](payload: Payloads.Partition<StoredValue>): Promise<Payloads.Partition<StoredValue>> {
    payload.data = { truthy: {}, falsy: {} };

    if (isPartitionByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data || {})) {
        const filterValue = await hook(value);

        if (filterValue) payload.data.truthy[key] = value;
        else payload.data.falsy[key] = value;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = this.error({
          identifier: MongoProvider.CommonIdentifiers.PartitionInvalidValue,
          message: 'The "value" must be a primitive type.',
          method: Method.Partition
        });

        return payload;
      }

      for (const [key, storedValue] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data || {}))
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data.truthy[key] = storedValue;
        else payload.data.falsy[key] = storedValue;
    }

    return payload;
  }

  public async [Method.Push]<Value = StoredValue>(payload: Payloads.Push<Value>): Promise<Payloads.Push<Value>> {
    const { key, path, value } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = this.error({
        identifier: MongoProvider.CommonIdentifiers.PushMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Push
      });

      return payload;
    }

    if (!Array.isArray(data)) {
      payload.error = this.error({
        identifier: MongoProvider.CommonIdentifiers.PushInvalidType,
        message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Push
      });

      return payload;
    }

    data.push(value);

    await this.set({ method: Method.Set, key, path, value: data });

    return payload;
  }

  public async [Method.Random](payload: Payloads.Random<StoredValue>): Promise<Payloads.Random<StoredValue>> {
    const aggr: PipelineStage[] = [{ $sample: { size: payload.count } }];

    // if (!payload.duplicates) {
    //   aggr.push(...[{ $group: { _id: '$key' } }]); Yet to be implemented
    // }

    const docs: MongoProvider.DocType[] = (await this.collection.aggregate(aggr)) || [];

    if (docs.length > 0) payload.data = docs.map((doc) => (this.options.disableSerialization ? doc.value : this.deserialize(doc.value)));

    return payload;
  }

  public async [Method.RandomKey](payload: Payloads.RandomKey): Promise<Payloads.RandomKey> {
    const docs = (await this.collection.aggregate([{ $sample: { size: payload.count } }])) || [];

    if (docs.length > 0) payload.data = docs.map((doc) => doc.key);

    return payload;
  }

  public async [Method.Remove]<HookValue = StoredValue>(payload: Payloads.Remove.ByHook<HookValue>): Promise<Payloads.Remove.ByHook<HookValue>>;
  public async [Method.Remove](payload: Payloads.Remove.ByValue): Promise<Payloads.Remove.ByValue>;
  public async [Method.Remove]<HookValue = StoredValue>(payload: Payloads.Remove<HookValue>): Promise<Payloads.Remove<HookValue>> {
    if (isRemoveByHookPayload(payload)) {
      const { key, path, hook } = payload;
      const { data } = await this.get<unknown[]>({ method: Method.Get, key, path });

      if (data === undefined) {
        payload.error = this.error({
          identifier: MongoProvider.CommonIdentifiers.RemoveMissingData,
          message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
          method: Method.Remove
        });

        return payload;
      }

      if (!Array.isArray(data)) {
        payload.error = this.error({
          identifier: MongoProvider.CommonIdentifiers.RemoveInvalidType,
          message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" must be an array.`,
          method: Method.Remove
        });

        return payload;
      }

      const filterValues = await Promise.all(data.map(hook));

      await this.set({ method: Method.Set, key, path, value: data.filter((_, index) => !filterValues[index]) });
    }

    if (isRemoveByValuePayload(payload)) {
      const { key, path, value } = payload;
      const { data } = await this.get({ method: Method.Get, key, path });

      if (data === undefined) {
        payload.error = this.error({
          identifier: MongoProvider.CommonIdentifiers.RemoveMissingData,
          message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
          method: Method.Remove
        });

        return payload;
      }

      if (!Array.isArray(data)) {
        payload.error = this.error({
          identifier: MongoProvider.CommonIdentifiers.RemoveInvalidType,
          message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" must be an array.`,
          method: Method.Remove
        });

        return payload;
      }

      await this.set({ method: Method.Set, key, path, value: data.filter((storedValue) => value !== storedValue) });
    }

    return payload;
  }

  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
    const { key, path, value } = payload;
    const val = path.length > 0 ? setToObject((await this.get({ method: Method.Get, key, path })).data, path, value) : value;

    await this.collection.findOneAndUpdate(
      {
        key: { $eq: key }
      },
      {
        $set: { value: this.options.disableSerialization ? val : this.serialize(val) }
      },
      {
        upsert: true
      }
    );

    return payload;
  }

  public async [Method.SetMany]<Value = StoredValue>(payload: Payloads.SetMany<Value>): Promise<Payloads.SetMany<Value>> {
    const { entries } = payload;
    const operations = [];

    for (const [{ key, path }, value] of entries) {
      if (!payload.overwrite) {
        const found = (await this.has({ method: Method.Has, key, path, data: false })).data;

        if (found) continue;
      }

      const val = path.length > 0 ? setToObject((await this.get({ method: Method.Get, key, path: [] })).data, path, value) : value;

      operations.push({
        updateOne: {
          filter: { key },
          upsert: true,
          update: {
            $set: {
              value: this.options.disableSerialization ? val : this.serialize(val)
            }
          }
        }
      });
    }

    await this.collection.bulkWrite(operations);

    return payload;
  }

  public async [Method.Size](payload: Payloads.Size): Promise<Payloads.Size> {
    payload.data = (await this.collection.countDocuments({})) ?? payload.data;

    return payload;
  }

  public async [Method.Some](payload: Payloads.Some.ByHook<StoredValue>): Promise<Payloads.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payloads.Some.ByValue): Promise<Payloads.Some.ByValue>;
  public async [Method.Some](payload: Payloads.Some<StoredValue>): Promise<Payloads.Some<StoredValue>> {
    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of (await this.values({ method: Method.Values, data: [] })).data || []) {
        const someValue = await hook(value);

        if (!someValue) continue;

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for (const storedValue of (await this.values({ method: Method.Values, data: [] })).data || []) {
        if (path.length !== 0 && value !== getFromObject(storedValue, path)) continue;
        if (isPrimitive(storedValue) && value === storedValue) continue;

        payload.data = true;
      }
    }

    return payload;
  }

  public async [Method.Update]<Value = StoredValue>(payload: Payloads.Update<StoredValue, Value>): Promise<Payloads.Update<StoredValue, Value>> {
    const { key, path, hook } = payload;
    const { data } = await this.get<StoredValue>({ method: Method.Get, key, path });

    if (data === undefined) return payload;

    Reflect.set(payload, 'data', await hook(data));
    await this.set({ method: Method.Set, key, path, value: await hook(data) });

    return payload;
  }

  public async [Method.Values](payload: Payloads.Values<StoredValue>): Promise<Payloads.Values<StoredValue>> {
    const docs = (await this.collection.find({}, { value: 1 })) || [];

    payload.data = docs.map((doc) => (this.options.disableSerialization ? doc.value : this.deserialize(doc.value)));

    return payload;
  }

  private get client(): Mongoose {
    if (isNullOrUndefined(this._client))
      throw this.error({
        message: 'Client is not connected, most likely due to `init` not being called or the server not being available',
        identifier: MongoProvider.Identifiers.NotConnected
      });

    return this._client;
  }

  private get collection(): Model<MongoProvider.DocType> {
    if (isNullOrUndefined(this._collection))
      throw this.error({
        message: 'Client is not connected, most likely due to `init` not being called or the server not being available',
        identifier: MongoProvider.Identifiers.NotConnected
      });

    return this._collection;
  }

  private deserialize(value: string): StoredValue {
    return new Serialize({ json: JSON.parse(value) }).toRaw<StoredValue>();
  }

  private serialize<Value = StoredValue>(value: StoredValue | Value) {
    return JSON.stringify(new Serialize({ raw: value }).toJSON());
  }

  public static defaultAuthentication: MongoProvider.Authentication = { dbName: 'josh', host: 'localhost', port: 27017 };

  public static schema = new Schema({ key: { type: String, required: true }, value: { type: Schema.Types.Mixed, required: true } });

  public static generateMongoDoc(collectionName: string): Model<MongoProvider.DocType> {
    return model('MongoDoc', MongoProvider.schema, collectionName);
  }
}

export namespace MongoProvider {
  export interface Options {
    collectionName?: string;

    connectOptions?: ConnectOptions;

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

  export interface DocType extends Document {
    key: string;

    value: any;
  }

  export enum Identifiers {
    InitMissingCollectionName = 'initMissingCollectionName',

    NotConnected = 'notConnected'
  }
}
