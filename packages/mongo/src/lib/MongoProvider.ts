import { deleteFromObject, getFromObject, hasFromObject } from '@realware/utilities';
import { isNumber, isPrimitive } from '@sapphire/utilities';
import {
	AutoKeyPayload,
	ClearPayload,
	DecPayload,
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
	JoshProviderError,
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

import { v4 } from 'uuid';
import mongoose, { Mongoose } from 'mongoose';
import { getModelForClass, prop, ReturnModelType, Severity } from '@typegoose/typegoose';
import type { BeAnObject } from '@typegoose/typegoose/lib/types';

class DocType {
	@prop({ required: true })
	public key!: string;

	@prop({ required: true })
	public value: any;
}

/**
 * The error class for the MongoProvider.
 * @since 2.0.0
 */
export class MongoProviderError extends JoshProviderError {
	/**
	 * The name for this error.
	 */
	public get name() {
		return 'MongoProviderError';
	}
}

export interface MongoProviderOptions {
	collection: string;
	auth?: {
		user?: string;
		password?: string;
		dbName?: string;
		port?: number;
		host?: string;
		url?: string;
	};
}

export class MongoProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
	private connectionURI: string;
	private client?: Mongoose;
	private collection?: ReturnModelType<typeof DocType, BeAnObject>;

	public constructor(options: MongoProviderOptions) {
		super();

		if (!options.collection) {
			throw new JoshError({
				identifier: MongoProvider.Identifiers.InvalidCollectionName,
				message: 'Collection name must be provided'
			});
		}

		const collection = options.collection.replace(/[^a-z0-9]/gi, '_').toLowerCase();

		this.collection = getModelForClass(DocType, { schemaOptions: { collection }, options: { allowMixed: Severity.ALLOW } });

		if (options.auth?.url) {
			this.connectionURI = options.auth.url;
		} else {
			const auth = options.auth?.user && options.auth.password ? `${options.auth.user}:${options.auth.password}@` : '';
			const dbName = options.auth?.dbName || 'josh';
			const host = options.auth?.host || 'localhost';
			const port = options.auth?.port || 27017;

			this.connectionURI = `mongodb://${auth}${host}:${port}/${dbName}`;
		}

		return this;
	}

	public async init(context: JoshProvider.Context<StoredValue>): Promise<JoshProvider.Context<StoredValue>> {
		this.client = await mongoose.connect(this.connectionURI);
		context = await super.init(context);

		return context;
	}

	public async close() {
		return this.client?.disconnect();
	}

	public [Method.AutoKey](payload: AutoKeyPayload): AutoKeyPayload {
		payload.data = v4();

		return payload;
	}

	public async [Method.Clear](payload: ClearPayload): Promise<ClearPayload> {
		await this.collection?.deleteMany({});

		return payload;
	}

	public async [Method.Dec](payload: DecPayload): Promise<DecPayload> {
		const { key, path } = payload;
		const { data: value } = (await this.get({ key, method: Method.Get, path })) as { data: any };

		if (value === undefined) {
			payload.error = new JoshProviderError({
				identifier: MongoProvider.Identifiers.DecInvalidType,
				message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Dec
			});

			return payload;
		}
		if (!isNumber(value)) {
			payload.error = new JoshProviderError({
				identifier: MongoProvider.Identifiers.DecInvalidType,
				message:
					path.length === 0 ? `The data at "${key}" must be of type "number".` : `The data at "${key}.${path.join('.')}" must be of type "number".`,
				method: Method.Dec
			});

			return payload;
		}

		await this.set({ method: Method.Set, key, path, value: value - 1 });

		return payload;
	}

	public async [Method.Delete](payload: DeletePayload): Promise<DeletePayload> {
		const { key, path } = payload;

		if ((await this.has({ method: Method.Has, key, path, data: false })).data) {
			const { data } = await this.get({ method: Method.Get, key, path: [] });

			deleteFromObject(data, path);

			await this.set({ key, path, value: data, method: Method.Set });

			return payload;
		}

		return payload;
	}

	public async [Method.Ensure](payload: EnsurePayload<StoredValue>): Promise<EnsurePayload<StoredValue>> {
		const { key } = payload;

		if (!(await this.has({ key, method: Method.Has, data: false, path: [] })))
			await this.set({ key, value: payload.defaultValue, method: Method.Set, path: [] });

		Reflect.set(payload, 'data', await this.get({ key, method: Method.Get, path: [] }));

		return payload;
	}

	public async [Method.Every](payload: EveryByHookPayload<StoredValue>): Promise<EveryByHookPayload<StoredValue>>;
	public async [Method.Every](payload: EveryByValuePayload): Promise<EveryByValuePayload>;
	public async [Method.Every](payload: EveryPayload<StoredValue>): Promise<EveryPayload<StoredValue>> {
		if (isEveryByHookPayload(payload)) {
			const { hook } = payload;

			for (const [_key, value] of Object.entries((await this.getAll({ method: Method.GetAll, data: {} })).data)) {
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
					identifier: MongoProvider.Identifiers.FilterInvalidValue,
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

			for (const value of (await this.values({ method: Method.Values, data: [] })).data) {
				const foundValue = await hook(value);

				if (!foundValue) continue;

				payload.data = value;

				break;
			}
		}

		if (isFindByValuePayload(payload)) {
			const { path, value } = payload;

			if (!isPrimitive(value)) {
				payload.error = new MongoProviderError({
					identifier: MongoProvider.Identifiers.FindInvalidValue,
					message: 'The "value" must be of type primitive.',
					method: Method.Find
				});

				return payload;
			}

			for (const storedValue of (await this.values({ method: Method.Values, data: [] })).data) {
				if (payload.data !== undefined) break;
				if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data = storedValue;
			}
		}

		return payload;
	}

	public async [Method.Get]<StoredValue>(payload: GetPayload<StoredValue>): Promise<GetPayload<StoredValue>> {
		const { key, path } = payload;

		const doc = await this.collection?.findOne({ key });

		if (!doc) {
			payload.data = undefined;

			return payload;
		}

		payload.data = doc.value;

		if (path.length > 0) payload.data = getFromObject(payload.data, path);

		return payload;
	}

	public async [Method.GetAll](payload: GetAllPayload<StoredValue>): Promise<GetAllPayload<StoredValue>> {
		const docs = (await this.collection?.find({})) || [];

		for (const doc of docs) {
			payload.data[doc.key] = doc.value;
		}

		return payload;
	}

	public async [Method.GetMany](payload: GetManyPayload<StoredValue>): Promise<GetManyPayload<StoredValue>> {
		const { keys } = payload;

		const docs = (await this.collection?.find({ key: { $in: keys } })) || [];

		for (const doc of docs) {
			payload.data[doc.key] = doc.value;
		}

		return payload;
	}

	public async [Method.Has](payload: HasPayload): Promise<HasPayload> {
		const { key, path } = payload;

		const isThere = await this.collection?.exists({ key });

		if (isThere) {
			payload.data = true;

			if (path.length !== 0) payload.data = hasFromObject(await this.get({ key, method: Method.Get, path: [] }), path);
		}

		return payload;
	}

	public async [Method.Inc](payload: IncPayload): Promise<IncPayload> {
		const { key, path } = payload;
		const { data } = await this.get<StoredValue>({ method: Method.Get, key, path });

		if (data === undefined) {
			payload.error = new MongoProviderError({
				identifier: MongoProvider.Identifiers.IncMissingData,
				message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Inc
			});

			return payload;
		}
		if (!isNumber(data)) {
			payload.error = new MongoProviderError({
				identifier: MongoProvider.Identifiers.IncInvalidType,
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
		const docs = (await this.collection?.find({})) || [];

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

			for (const value of (await this.values({ method: Method.Values, data: [] })).data) {
				payload.data.push((path.length === 0 ? value : getFromObject(value, path)) as DataValue);
			}
		}

		return payload;
	}

	public async [Method.Math](payload: MathPayload): Promise<MathPayload> {
		const { key, path, operator, operand } = payload;
		let { data } = await this.get<number>({ method: Method.Get, key, path });

		if (data === undefined) {
			payload.error = new MongoProviderError({
				identifier: MongoProvider.Identifiers.MathMissingData,
				message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Math
			});

			return payload;
		}

		if (!isNumber(data)) {
			payload.error = new MongoProviderError({
				identifier: MongoProvider.Identifiers.MathInvalidType,
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
					identifier: MongoProvider.Identifiers.PartitionInvalidValue,
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
				identifier: MongoProvider.Identifiers.PushMissingData,
				message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Push
			});

			return payload;
		}

		if (!Array.isArray(data)) {
			payload.error = new MongoProviderError({
				identifier: MongoProvider.Identifiers.PushInvalidType,
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
		const docs = (await this.collection?.aggregate([{ $sample: { size: 1 } }])) || [];

		payload.data = docs.length > 0 ? docs[0].value : '';

		return payload;
	}

	public async [Method.RandomKey](payload: RandomKeyPayload): Promise<RandomKeyPayload> {
		const docs = (await this.collection?.aggregate([{ $sample: { size: 1 } }])) || [];

		payload.data = docs.length > 0 ? docs[0].key : '';

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
					identifier: MongoProvider.Identifiers.RemoveMissingData,
					message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
					method: Method.Remove
				});

				return payload;
			}

			if (!Array.isArray(data)) {
				payload.error = new MongoProviderError({
					identifier: MongoProvider.Identifiers.RemoveInvalidType,
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
					identifier: MongoProvider.Identifiers.RemoveMissingData,
					message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
					method: Method.Remove
				});

				return payload;
			}

			if (!Array.isArray(data)) {
				payload.error = new MongoProviderError({
					identifier: MongoProvider.Identifiers.RemoveInvalidType,
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

		await this.collection?.findOneAndUpdate(
			{
				key: { $eq: key }
			},
			{
				$set: { key, [`${path.length > 0 ? `value.${path.join('.')}` : 'value'}`]: value }
			},
			{
				upsert: true
			}
		);

		return payload;
	}

	public async [Method.SetMany](payload: SetManyPayload<StoredValue>): Promise<SetManyPayload<StoredValue>> {
		const { keys, value } = payload;

		for (const key of keys) {
			await this.set({ key, value, path: [], method: Method.Set });
		}

		return payload;
	}

	public async [Method.Size](payload: SizePayload): Promise<SizePayload> {
		payload.data = (await this.collection?.countDocuments({})) || 0;

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
		const docs = (await this.collection?.find({})) || [];

		for (const doc of docs) payload.data.push(doc.value);

		return payload;
	}
}

export namespace MongoProvider {
	export enum Identifiers {
		InvalidCollectionName = 'invalidCollectionName',

		NotConnected = 'notConnected',

		DecInvalidType = 'decInvalidType',

		DecMissingData = 'decMissingData',

		FilterInvalidValue = 'filterInvalidValue',

		FindInvalidValue = 'findInvalidValue',

		IncInvalidType = 'incInvalidType',

		IncMissingData = 'incMissingData',

		MathInvalidType = 'mathInvalidType',

		MathMissingData = 'mathMissingData',

		PartitionInvalidValue = 'partitionInvalidValue',

		PushInvalidType = 'pushInvalidType',

		PushMissingData = 'pushMissingData',

		RemoveInvalidType = 'removeInvalidType',

		RemoveMissingData = 'removeMissingData'
	}
}
