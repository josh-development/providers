import {
  AutoKeyPayload,
  ClearPayload,
  DecPayload,
  DeleteManyPayload,
  DeletePayload,
  EnsurePayload,
  EveryByHookPayload,
  EveryByValuePayload,
  EveryPayload,
  FilterByHookPayload,
  FilterByValuePayload,
  FilterPayload,
  FindByHookPayload,
  FindByValuePayload,
  FindPayload,
  GetAllPayload,
  GetManyPayload,
  GetPayload,
  HasPayload,
  IncPayload,
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
  JoshError,
  JoshProvider,
  KeysPayload,
  MapByHookPayload,
  MapByPathPayload,
  MapPayload,
  MathOperator,
  MathPayload,
  Method,
  PartitionByHookPayload,
  PartitionByValuePayload,
  PartitionPayload,
  PushPayload,
  RandomKeyPayload,
  RandomPayload,
  RemoveByHookPayload,
  RemoveByValuePayload,
  RemovePayload,
  SetManyPayload,
  SetPayload,
  SizePayload,
  SomeByHookPayload,
  SomeByValuePayload,
  SomePayload,
  UpdatePayload,
  ValuesPayload
} from '@joshdb/core';
import { Serialize } from '@joshdb/serialize';
import { deleteFromObject, getFromObject, hasFromObject, setToObject } from '@realware/utilities';
import { isNullOrUndefined, isNumber, isPrimitive } from '@sapphire/utilities';
import mongoose, { Model, Mongoose, PipelineStage } from 'mongoose';
import { generateMongoDoc } from './MongoDoc';
import type { MongoDocType } from './MongoDocType';
import { MongoProviderError } from './MongoProviderError';

export class MongoProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: MongoProvider.Options;

  private connectionURI?: string;

  private _client?: Mongoose;

  private _collection?: Model<MongoDocType>;

  public constructor(options: MongoProvider.Options) {
    super(options);
  }

  public async init(context: JoshProvider.Context<StoredValue>): Promise<JoshProvider.Context<StoredValue>> {
    context = await super.init(context);

    const { collectionName = context.name, enforceCollectionName, authentication = MongoProvider.defaultAuthentication } = this.options;

    if (collectionName === undefined)
      throw new JoshError({
        message: 'A collection name must be provided if using this class without Josh.',
        identifier: MongoProvider.Identifiers.InitMissingCollectionName
      });

    this._collection = generateMongoDoc(enforceCollectionName ? collectionName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : collectionName);

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

    this._client = await mongoose.connect(this.connectionURI);

    return context;
  }

  public async close() {
    return this.client.disconnect();
  }

  public [Method.AutoKey](payload: AutoKeyPayload): AutoKeyPayload {
    payload.data = new mongoose.Types.ObjectId().toString();

    return payload;
  }

  public async [Method.Clear](payload: ClearPayload): Promise<ClearPayload> {
    await this.collection.deleteMany({});

    return payload;
  }

  public async [Method.Dec](payload: DecPayload): Promise<DecPayload> {
    const { key, path } = payload;
    const { data } = await this.get<StoredValue>({ key, method: Method.Get, path });

    if (data === undefined) {
      payload.error = new MongoProviderError({
        identifier: MongoProvider.CommonIdentifiers.DecMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Dec
      });

      return payload;
    }

    if (!isNumber(data)) {
      payload.error = new MongoProviderError({
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

  public async [Method.Delete](payload: DeletePayload): Promise<DeletePayload> {
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

  public async [Method.DeleteMany](payload: DeleteManyPayload): Promise<DeleteManyPayload> {
    const { keys } = payload;

    await this.collection.deleteMany({ key: { $in: keys } });

    return payload;
  }

  public async [Method.Ensure](payload: EnsurePayload<StoredValue>): Promise<EnsurePayload<StoredValue>> {
    const { key } = payload;

    if (!(await this.has({ key, method: Method.Has, data: false, path: [] })).data)
      await this.set({ key, value: payload.defaultValue, method: Method.Set, path: [] });

    payload.data = (await this.get({ key, method: Method.Get, path: [] })).data as StoredValue;

    return payload;
  }

  public async [Method.Every](payload: EveryByHookPayload<StoredValue>): Promise<EveryByHookPayload<StoredValue>>;
  public async [Method.Every](payload: EveryByValuePayload): Promise<EveryByValuePayload>;
  public async [Method.Every](payload: EveryPayload<StoredValue>): Promise<EveryPayload<StoredValue>> {
    if ((await this.size({ method: Method.Size, data: 0 })).data === 0) {
      payload.data = true;

      return payload;
    }
    if (isEveryByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of (await this.values({ method: Method.Values, data: [] })).data) {
        const everyValue = await hook(value);

        if (everyValue) continue;

        payload.data = false;
      }
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;

      for (const key of (await this.keys({ method: Method.Keys, data: [] })).data) {
        const { data } = await this.get({ method: Method.Get, key, path });

        if (value === data) continue;

        payload.data = false;
      }
    }

    return payload;
  }

  public async [Method.Filter](payload: FilterByHookPayload<StoredValue>): Promise<FilterByHookPayload<StoredValue>>;
  public async [Method.Filter](payload: FilterByValuePayload<StoredValue>): Promise<FilterByValuePayload<StoredValue>>;
  public async [Method.Filter](payload: FilterPayload<StoredValue>): Promise<FilterPayload<StoredValue>> {
    if (isFilterByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data)) {
        const filterValue = await hook(value);

        if (!filterValue) continue;

        payload.data[key] = value;
      }
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = new MongoProviderError({
          identifier: MongoProvider.CommonIdentifiers.FilterInvalidValue,
          message: 'The "value" must be a primitive type.',
          method: Method.Filter
        });

        return payload;
      }

      for (const [key, storedValue] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data))
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data[key] = storedValue;
    }

    return payload;
  }

  public async [Method.Find](payload: FindByHookPayload<StoredValue>): Promise<FindByHookPayload<StoredValue>>;
  public async [Method.Find](payload: FindByValuePayload<StoredValue>): Promise<FindByValuePayload<StoredValue>>;
  public async [Method.Find](payload: FindPayload<StoredValue>): Promise<FindPayload<StoredValue>> {
    if (isFindByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, storedValue] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data)) {
        const foundValue = await hook(storedValue);

        if (!foundValue) continue;

        payload.data = [key, storedValue];

        break;
      }
    }

    if (isFindByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = new MongoProviderError({
          identifier: MongoProvider.CommonIdentifiers.FindInvalidValue,
          message: 'The "value" must be of type primitive.',
          method: Method.Find
        });

        return payload;
      }

      for (const [key, storedValue] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data)) {
        if (payload.data !== undefined) break;
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data = [key, storedValue];
      }
    }

    return payload;
  }

  public async [Method.Get]<StoredValue>(payload: GetPayload<StoredValue>): Promise<GetPayload<StoredValue>> {
    const { key, path } = payload;

    const doc = await this.collection.findOne({ key });

    if (!doc) {
      payload.data = undefined;

      return payload;
    }

    Reflect.set(payload, 'data', this.deserialize(doc.value));

    if (path.length > 0) payload.data = getFromObject(payload.data, path);

    return payload;
  }

  public async [Method.GetAll](payload: GetAllPayload<StoredValue>): Promise<GetAllPayload<StoredValue>> {
    const docs = (await this.collection.find({})) || [];

    for (const doc of docs) Reflect.set(payload.data, doc.key, this.deserialize(doc.value));

    return payload;
  }

  public async [Method.GetMany](payload: GetManyPayload<StoredValue>): Promise<GetManyPayload<StoredValue>> {
    const { keys } = payload;

    const docs = (await this.collection.find({ key: { $in: keys } })) || [];

    for (const doc of docs) Reflect.set(payload.data, doc.key, this.deserialize(doc.value));

    return payload;
  }

  public async [Method.Has](payload: HasPayload): Promise<HasPayload> {
    const { key, path } = payload;
    let isThere = (await this.collection.exists({ key })) !== null;

    if (path.length !== 0 && isThere) {
      const value = await this.get({ method: Method.Get, key, path: [] });

      isThere = hasFromObject(value.data, path);
    }

    payload.data = isThere;

    return payload;
  }

  public async [Method.Inc](payload: IncPayload): Promise<IncPayload> {
    const { key, path } = payload;
    const { data } = await this.get<StoredValue>({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = new MongoProviderError({
        identifier: MongoProvider.CommonIdentifiers.IncMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Inc
      });

      return payload;
    }
    if (!isNumber(data)) {
      payload.error = new MongoProviderError({
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

  public async [Method.Keys](payload: KeysPayload): Promise<KeysPayload> {
    const docs = (await this.collection.find({})) || [];

    for (const doc of docs) payload.data.push(doc.key);

    return payload;
  }

  public async [Method.Map]<DataValue = StoredValue, HookValue = DataValue>(
    payload: MapByHookPayload<DataValue, HookValue>
  ): Promise<MapByHookPayload<DataValue, HookValue>>;

  public async [Method.Map]<DataValue = StoredValue>(payload: MapByPathPayload<DataValue>): Promise<MapByPathPayload<DataValue>>;
  public async [Method.Map]<DataValue = StoredValue, HookValue = DataValue>(
    payload: MapPayload<DataValue, HookValue>
  ): Promise<MapPayload<DataValue, HookValue>> {
    if (isMapByHookPayload(payload)) {
      const { hook } = payload;

      // @ts-expect-error 2345
      for (const value of (await this.values({ method: Method.Values, data: [] })).data) payload.data.push(await hook(value));
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;

      for (const value of (await this.values({ method: Method.Values, data: [] })).data)
        payload.data.push((path.length === 0 ? value : getFromObject(value, path)) as DataValue);
    }

    return payload;
  }

  public async [Method.Math](payload: MathPayload): Promise<MathPayload> {
    const { key, path, operator, operand } = payload;
    let { data } = await this.get<number>({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = new MongoProviderError({
        identifier: MongoProvider.CommonIdentifiers.MathMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Math
      });

      return payload;
    }

    if (!isNumber(data)) {
      payload.error = new MongoProviderError({
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

  public async [Method.Partition](payload: PartitionByHookPayload<StoredValue>): Promise<PartitionByHookPayload<StoredValue>>;
  public async [Method.Partition](payload: PartitionByValuePayload<StoredValue>): Promise<PartitionByValuePayload<StoredValue>>;
  public async [Method.Partition](payload: PartitionPayload<StoredValue>): Promise<PartitionPayload<StoredValue>> {
    if (isPartitionByHookPayload(payload)) {
      const { hook } = payload;

      for (const [key, value] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data)) {
        const filterValue = await hook(value);

        if (filterValue) payload.data.truthy[key] = value;
        else payload.data.falsy[key] = value;
      }
    }

    if (isPartitionByValuePayload(payload)) {
      const { path, value } = payload;

      if (!isPrimitive(value)) {
        payload.error = new MongoProviderError({
          identifier: MongoProvider.CommonIdentifiers.PartitionInvalidValue,
          message: 'The "value" must be a primitive type.',
          method: Method.Partition
        });

        return payload;
      }

      for (const [key, storedValue] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data))
        if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data.truthy[key] = storedValue;
        else payload.data.falsy[key] = storedValue;
    }

    return payload;
  }

  public async [Method.Push]<Value = StoredValue>(payload: PushPayload<Value>): Promise<PushPayload<Value>> {
    const { key, path, value } = payload;
    const { data } = await this.get({ method: Method.Get, key, path });

    if (data === undefined) {
      payload.error = new MongoProviderError({
        identifier: MongoProvider.CommonIdentifiers.PushMissingData,
        message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
        method: Method.Push
      });

      return payload;
    }

    if (!Array.isArray(data)) {
      payload.error = new MongoProviderError({
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

  public async [Method.Random](payload: RandomPayload<StoredValue>): Promise<RandomPayload<StoredValue>> {
    const aggr: PipelineStage[] = [{ $sample: { size: payload.count } }];

    // if (!payload.duplicates) {
    //   aggr.push(...[{ $group: { _id: '$key' } }]); Yet to be implemented
    // }

    const docs: MongoDocType[] = (await this.collection.aggregate(aggr)) || [];

    if (docs.length > 0) payload.data = docs.map((doc) => this.deserialize(doc.value));

    return payload;
  }

  public async [Method.RandomKey](payload: RandomKeyPayload): Promise<RandomKeyPayload> {
    const docs = (await this.collection.aggregate([{ $sample: { size: payload.count } }])) || [];

    if (docs.length > 0) payload.data = docs.map((doc) => doc.key);

    return payload;
  }

  public async [Method.Remove]<HookValue = StoredValue>(payload: RemoveByHookPayload<HookValue>): Promise<RemoveByHookPayload<HookValue>>;
  public async [Method.Remove](payload: RemoveByValuePayload): Promise<RemoveByValuePayload>;
  public async [Method.Remove]<HookValue = StoredValue>(payload: RemovePayload<HookValue>): Promise<RemovePayload<HookValue>> {
    if (isRemoveByHookPayload(payload)) {
      const { key, path, hook } = payload;
      const { data } = await this.get<unknown[]>({ method: Method.Get, key, path });

      if (data === undefined) {
        payload.error = new MongoProviderError({
          identifier: MongoProvider.CommonIdentifiers.RemoveMissingData,
          message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
          method: Method.Remove
        });

        return payload;
      }

      if (!Array.isArray(data)) {
        payload.error = new MongoProviderError({
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
        payload.error = new MongoProviderError({
          identifier: MongoProvider.CommonIdentifiers.RemoveMissingData,
          message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
          method: Method.Remove
        });

        return payload;
      }

      if (!Array.isArray(data)) {
        payload.error = new MongoProviderError({
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

  public async [Method.Set]<Value = StoredValue>(payload: SetPayload<Value>): Promise<SetPayload<Value>> {
    const { key, path, value } = payload;

    await this.collection.findOneAndUpdate(
      {
        key: { $eq: key }
      },
      {
        $set: { value: this.serialize(path.length > 0 ? setToObject((await this.get({ method: Method.Get, key, path })).data, path, value) : value) }
      },
      {
        upsert: true
      }
    );

    return payload;
  }

  public async [Method.SetMany]<Value = StoredValue>(payload: SetManyPayload<Value>): Promise<SetManyPayload<Value>> {
    const { data } = payload;
    const operations = [];

    for (const [{ key, path }, value] of data) {
      if (!payload.overwrite) {
        const found = (await this.has({ method: Method.Has, key, path, data: false })).data;

        if (found) continue;
      }

      operations.push({
        updateOne: {
          filter: { key },
          upsert: true,
          update: {
            $set: {
              value: this.serialize(path.length > 0 ? setToObject((await this.get({ method: Method.Get, key, path: [] })).data, path, value) : value)
            }
          }
        }
      });
    }

    await this.collection.bulkWrite(operations);

    return payload;
  }

  public async [Method.Size](payload: SizePayload): Promise<SizePayload> {
    payload.data = (await this.collection.countDocuments({})) ?? payload.data;

    return payload;
  }

  public async [Method.Some](payload: SomeByHookPayload<StoredValue>): Promise<SomeByHookPayload<StoredValue>>;
  public async [Method.Some](payload: SomeByValuePayload): Promise<SomeByValuePayload>;
  public async [Method.Some](payload: SomePayload<StoredValue>): Promise<SomePayload<StoredValue>> {
    if (isSomeByHookPayload(payload)) {
      const { hook } = payload;

      for (const value of (await this.values({ method: Method.Values, data: [] })).data) {
        const someValue = await hook(value);

        if (!someValue) continue;

        payload.data = true;

        break;
      }
    }

    if (isSomeByValuePayload(payload)) {
      const { path, value } = payload;

      for (const storedValue of (await this.values({ method: Method.Values, data: [] })).data) {
        if (path.length !== 0 && value !== getFromObject(storedValue, path)) continue;
        if (isPrimitive(storedValue) && value === storedValue) continue;

        payload.data = true;
      }
    }

    return payload;
  }

  public async [Method.Update]<HookValue = StoredValue, Value = HookValue>(
    payload: UpdatePayload<StoredValue, HookValue, Value>
  ): Promise<UpdatePayload<StoredValue, HookValue, Value>> {
    const { key, path, hook } = payload;
    const { data } = await this.get<HookValue>({ method: Method.Get, key, path });

    if (data === undefined) return payload;

    Reflect.set(payload, 'data', await hook(data));
    await this.set({ method: Method.Set, key, path, value: payload.data });

    return payload;
  }

  public async [Method.Values](payload: ValuesPayload<StoredValue>): Promise<ValuesPayload<StoredValue>> {
    const docs = (await this.collection.find({})) || [];

    for (const doc of docs) payload.data.push(this.deserialize(doc.value));

    return payload;
  }

  private get client(): Mongoose {
    if (isNullOrUndefined(this._client))
      throw new JoshError({
        message: 'Client is not connected, most likely due to `init` not being called or the server not being available',
        identifier: MongoProvider.Identifiers.NotConnected
      });

    return this._client;
  }

  private get collection(): Model<MongoDocType> {
    if (isNullOrUndefined(this._collection))
      throw new JoshError({
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
}

export namespace MongoProvider {
  export interface Options {
    collectionName?: string;

    enforceCollectionName?: boolean;

    authentication?: Partial<Authentication> | string;
  }

  export interface Authentication {
    user?: string;

    password?: string;

    dbName: string;

    port: number;

    host: string;
  }

  export enum Identifiers {
    InitMissingCollectionName = 'initMissingCollectionName',

    NotConnected = 'notConnected'
  }
}
