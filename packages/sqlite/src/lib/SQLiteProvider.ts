import { resolve, sep } from 'path';
import fs from 'fs/promises';

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

import { deleteFromObject, getFromObject, setToObject } from '@realware/utilities';
import { isNullOrUndefined, isNumber, isPrimitive, isObject, deepClone } from '@sapphire/utilities';
import serialize from 'serialize-javascript';
import onChange from 'on-change';

import Database from 'better-sqlite3';

import { SQLiteProviderError } from './SQLiteProviderError';

export class SQLiteProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
	public declare options: SQLiteProvider.Options;
	public name: string;

	private _db?: Database.Database;
	private dataDir?: string;
	private deleteStmt?: Database.Statement;
	private insertStmt?: Database.Statement;
	private getPaginatedStmt?: Database.Statement;
	private runMany?: any;

	public constructor(options: SQLiteProvider.Options) {
		super(options);
		this.name = options.name;
	}

	public async init(context: JoshProvider.Context<StoredValue>): Promise<JoshProvider.Context<StoredValue>> {
		// Run the "init()" method on the super to get other properties set.
		context = await super.init(context);

		const { name, dataDir, inMemory, wal = true } = this.options;

		if (inMemory) {
			// This is there for testing purposes, really.
			// But hey, if you want an in-memory database, knock yourself out, kiddo!
			this._db = new Database(':memory:');
			this.name = 'InMemoryJosh';
		} else {
			if (!name) throw new Error('Must provide options.name');

			this.dataDir = resolve(process.cwd(), dataDir || 'data');

			if (!dataDir) {
				if (!(await fs.stat('./data'))?.isDirectory()) {
					await fs.mkdir('./data');
				}
			}

			this.name = name;
			this.validateName();
			this._db = new Database(`${this.dataDir}${sep}josh.sqlite`);

			const table = this.db.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(this.name);

			if (!table['count(*)']) {
				this.db.prepare(`CREATE TABLE '${this.name}' (key text, path text, value text, PRIMARY KEY('key','path'))`).run();
				this.db.pragma('synchronous = 1');

				if (wal) this.db.pragma('journal_mode = wal');
			}

			this.db.prepare(`CREATE TABLE IF NOT EXISTS 'internal::autonum' (josh TEXT PRIMARY KEY, lastnum INTEGER)`).run();

			const row = this.db.prepare("SELECT lastnum FROM 'internal::autonum' WHERE josh = ?").get(this.name);

			if (!row) {
				this.db.prepare("INSERT INTO 'internal::autonum' (josh, lastnum) VALUES (?, ?)").run(this.name, 0);
			}

			this.deleteStmt = this.db.prepare(`DELETE FROM '${this.name}' WHERE key=@key AND path=@path;`);

			this.insertStmt = this.db.prepare(`INSERT INTO '${this.name}' (key, path, value) VALUES (@key, @path, @value);`);

			this.getPaginatedStmt = this.db.prepare(
				`SELECT ROWID, * FROM '${this.name}' WHERE rowid > @lastRowId AND path = '::NULL::' ORDER BY rowid LIMIT @limit;`
			);

			this.runMany = this.db.transaction(async (transactions) => {
				for (const [statement, transactionRow] of transactions) {
					await statement.run(transactionRow);
				}
			});
		}

		// Make asynchronous functions here.

		return context;
	}

	public [Method.AutoKey](payload: AutoKeyPayload): AutoKeyPayload {
		let { lastnum } = this.db!.prepare("SELECT lastnum FROM 'internal::autonum' WHERE josh = ?").get(this.name);

		lastnum++;
		this.db.prepare("INSERT OR REPLACE INTO 'internal::autonum' (josh, lastnum) VALUES (?, ?)").run(this.name, lastnum);

		payload.data = lastnum.toString();

		return payload;
	}

	public [Method.Clear](payload: ClearPayload): ClearPayload {
		this.db.exec(`DELETE FROM '${this.name}'`);

		return payload;
	}

	public [Method.Dec](payload: DecPayload): DecPayload {
		const { key, path } = payload;
		const { data } = this.get<StoredValue>({ key, method: Method.Get, path });

		if (data === undefined) {
			payload.error = new SQLiteProviderError({
				identifier: JoshProvider.CommonIdentifiers.DecMissingData,
				message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Dec
			});

			return payload;
		}

		if (!isNumber(data)) {
			payload.error = new SQLiteProviderError({
				identifier: JoshProvider.CommonIdentifiers.DecInvalidType,
				message:
					path.length === 0 ? `The data at "${key}" must be of type "number".` : `The data at "${key}.${path.join('.')}" must be of type "number".`,
				method: Method.Dec
			});

			return payload;
		}

		this.set({ method: Method.Set, key, path, value: data - 1 });

		return payload;
	}

	public [Method.Delete](payload: DeletePayload): DeletePayload {
		const { key, path } = payload;

		if (path.length === 0) {
			this.db.prepare(`DELETE FROM '${this.name}' WHERE key = ?`).run(key);

			return payload;
		}

		if (this.has({ method: Method.Has, key, path, data: false }).data) {
			const { data } = this.get({ method: Method.Get, key, path: [] });

			deleteFromObject(data, path);

			this.set({ method: Method.Set, key, path: [], value: data });

			return payload;
		}

		return payload;
	}

	public [Method.Ensure](payload: EnsurePayload<StoredValue>): EnsurePayload<StoredValue> {
		const { key } = payload;

		if (!this.has({ key, method: Method.Has, data: false, path: [] }).data)
			this.set({ key, value: payload.defaultValue, method: Method.Set, path: [] });

		payload.data = this.get({ key, method: Method.Get, path: [] }).data as StoredValue;

		return payload;
	}

	public [Method.Every](payload: EveryByHookPayload<StoredValue>): EveryByHookPayload<StoredValue>;
	public [Method.Every](payload: EveryByValuePayload): EveryByValuePayload;
	public [Method.Every](payload: EveryPayload<StoredValue>): EveryPayload<StoredValue> {
		if (this.size({ method: Method.Size, data: 0 }).data === 0) {
			payload.data = true;

			return payload;
		}
		if (isEveryByHookPayload(payload)) {
			const { hook } = payload;

			for (const value of this.values({ method: Method.Values, data: [] }).data) {
				const everyValue = hook(value);

				if (everyValue) continue;

				payload.data = false;
			}
		}

		if (isEveryByValuePayload(payload)) {
			const { path, value } = payload;

			for (const key of this.keys({ method: Method.Keys, data: [] }).data) {
				const { data } = this.get({ method: Method.Get, key, path });

				if (value === data) continue;

				payload.data = false;
			}
		}

		return payload;
	}

	public [Method.Filter](payload: FilterByHookPayload<StoredValue>): FilterByHookPayload<StoredValue>;
	public [Method.Filter](payload: FilterByValuePayload<StoredValue>): FilterByValuePayload<StoredValue>;
	public [Method.Filter](payload: FilterPayload<StoredValue>): FilterPayload<StoredValue> {
		if (isFilterByHookPayload(payload)) {
			const { hook } = payload;

			for (const [key, value] of Object.entries(this.getAll({ method: Method.GetAll, data: {} }).data)) {
				const filterValue = hook(value);

				if (!filterValue) continue;

				payload.data[key] = value;
			}
		}

		if (isFilterByValuePayload(payload)) {
			const { path, value } = payload;

			if (!isPrimitive(value)) {
				payload.error = new SQLiteProviderError({
					identifier: JoshProvider.CommonIdentifiers.FilterInvalidValue,
					message: 'The "value" must be a primitive type.',
					method: Method.Filter
				});

				return payload;
			}

			for (const [key, storedValue] of Object.entries(this.getAll({ method: Method.GetAll, data: {} }).data))
				if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data[key] = storedValue;
		}

		return payload;
	}

	public [Method.Find](payload: FindByHookPayload<StoredValue>): FindByHookPayload<StoredValue>;
	public [Method.Find](payload: FindByValuePayload<StoredValue>): FindByValuePayload<StoredValue>;
	public [Method.Find](payload: FindPayload<StoredValue>): FindPayload<StoredValue> {
		if (isFindByHookPayload(payload)) {
			const { hook } = payload;

			for (const value of this.values({ method: Method.Values, data: [] }).data) {
				const foundValue = hook(value);

				if (!foundValue) continue;

				payload.data = value;

				break;
			}
		}

		if (isFindByValuePayload(payload)) {
			const { path, value } = payload;

			if (!isPrimitive(value)) {
				payload.error = new SQLiteProviderError({
					identifier: JoshProvider.CommonIdentifiers.FindInvalidValue,
					message: 'The "value" must be of type primitive.',
					method: Method.Find
				});

				return payload;
			}

			for (const storedValue of this.values({ method: Method.Values, data: [] }).data) {
				if (payload.data !== undefined) break;
				if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data = storedValue;
			}
		}

		return payload;
	}

	public [Method.Get]<StoredValue>(payload: GetPayload<StoredValue>): GetPayload<StoredValue> {
		const { key, path } = payload;

		const query = this.db.prepare(`SELECT * FROM '${this.name}' WHERE key = ?${path ? ' AND path = ?' : " AND path='::NULL::'"};`);
		const doc = path ? query.get(key, path) : query.get(key);

		if (!doc) {
			payload.data = undefined;

			return payload;
		}

		Reflect.set(payload, 'data', doc.value);

		if (path.length > 0) payload.data = getFromObject(payload.data, path);

		return payload;
	}

	public [Method.GetAll](payload: GetAllPayload<StoredValue>): GetAllPayload<StoredValue> {
		const docs = this.db
			.prepare(`SELECT * FROM '${this.name}' WHERE path='::NULL::';`)
			.all()
			.reduce((acc, row) => {
				acc[row.key] = this.parseData(row.value);

				return acc;
			}, {});

		for (const doc of docs) Reflect.set(payload.data, doc.key, doc.value);

		return payload;
	}

	public [Method.GetMany](payload: GetManyPayload<StoredValue>): GetManyPayload<StoredValue> {
		const { keys } = payload;

		const docs = this.db
			.prepare(`SELECT * FROM '${this.name}' WHERE key IN (${'?, '.repeat(keys.length).slice(0, -2)}) AND path='::NULL::';`)
			.all(keys)
			.reduce((acc, row) => {
				acc[row.key] = this.parseData(row.value);

				return acc;
			}, {});

		for (const doc of docs) Reflect.set(payload.data, doc.key, doc.value);

		return payload;
	}

	public [Method.Has](payload: HasPayload): HasPayload {
		const { key, path } = payload;

		const query = this.db.prepare(`SELECT count(*) FROM '${this.name}' WHERE key = ?${path ? ' AND path = ?' : "AND path='::NULL::'"};`);
		const doc = path ? query.get(key, path) : query.get(key);

		payload.data = doc['count(*)'] === 1;

		return payload;
	}

	public [Method.Inc](payload: IncPayload): IncPayload {
		const { key, path } = payload;
		const { data } = this.get<StoredValue>({ method: Method.Get, key, path });

		if (data === undefined) {
			payload.error = new SQLiteProviderError({
				identifier: JoshProvider.CommonIdentifiers.IncMissingData,
				message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Inc
			});

			return payload;
		}
		if (!isNumber(data)) {
			payload.error = new SQLiteProviderError({
				identifier: JoshProvider.CommonIdentifiers.IncInvalidType,
				message:
					path.length === 0 ? `The data at "${key}" must be of type "number".` : `The data at "${key}.${path.join('.')}" must be of type "number".`,
				method: Method.Inc
			});

			return payload;
		}

		this.set({ method: Method.Set, key, path, value: data + 1 });

		return payload;
	}

	public [Method.Keys](payload: KeysPayload): KeysPayload {
		const docs = this.db.prepare(`SELECT key FROM '${this.name}' WHERE path='::NULL::';`).all();

		for (const doc of docs) payload.data.push(doc.key);

		return payload;
	}

	public [Method.Map]<DataValue = StoredValue, HookValue = DataValue>(
		payload: MapByHookPayload<DataValue, HookValue>
	): MapByHookPayload<DataValue, HookValue>;

	public [Method.Map]<DataValue = StoredValue>(payload: MapByPathPayload<DataValue>): MapByPathPayload<DataValue>;
	public [Method.Map]<DataValue = StoredValue, HookValue = DataValue>(payload: MapPayload<DataValue, HookValue>): MapPayload<DataValue, HookValue> {
		if (isMapByHookPayload(payload)) {
			const { hook } = payload;

			// @ts-expect-error 2345
			for (const value of this.values({ method: Method.Values, data: [] }).data) payload.data.push(hook(value));
		}

		if (isMapByPathPayload(payload)) {
			const { path } = payload;

			for (const value of this.values({ method: Method.Values, data: [] }).data)
				payload.data.push((path.length === 0 ? value : getFromObject(value, path)) as DataValue);
		}

		return payload;
	}

	public [Method.Math](payload: MathPayload): MathPayload {
		const { key, path, operator, operand } = payload;
		let { data } = this.get<number>({ method: Method.Get, key, path });

		if (data === undefined) {
			payload.error = new SQLiteProviderError({
				identifier: JoshProvider.CommonIdentifiers.MathMissingData,
				message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Math
			});

			return payload;
		}

		if (!isNumber(data)) {
			payload.error = new SQLiteProviderError({
				identifier: JoshProvider.CommonIdentifiers.MathInvalidType,
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

		this.set({ method: Method.Set, key, path, value: data });

		return payload;
	}

	public [Method.Partition](payload: PartitionByHookPayload<StoredValue>): PartitionByHookPayload<StoredValue>;
	public [Method.Partition](payload: PartitionByValuePayload<StoredValue>): PartitionByValuePayload<StoredValue>;
	public [Method.Partition](payload: PartitionPayload<StoredValue>): PartitionPayload<StoredValue> {
		if (isPartitionByHookPayload(payload)) {
			const { hook } = payload;

			for (const [key, value] of Object.entries(this.getAll({ method: Method.GetAll, data: {} }).data)) {
				const filterValue = hook(value);

				if (filterValue) payload.data.truthy[key] = value;
				else payload.data.falsy[key] = value;
			}
		}

		if (isPartitionByValuePayload(payload)) {
			const { path, value } = payload;

			if (!isPrimitive(value)) {
				payload.error = new SQLiteProviderError({
					identifier: JoshProvider.CommonIdentifiers.PartitionInvalidValue,
					message: 'The "value" must be a primitive type.',
					method: Method.Partition
				});

				return payload;
			}

			for (const [key, storedValue] of Object.entries(this.getAll({ method: Method.GetAll, data: {} }).data))
				if (value === (path.length === 0 ? storedValue : getFromObject(storedValue, path))) payload.data.truthy[key] = storedValue;
				else payload.data.falsy[key] = storedValue;
		}

		return payload;
	}

	public [Method.Push]<Value = StoredValue>(payload: PushPayload<Value>): PushPayload<Value> {
		const { key, path, value } = payload;
		const { data } = this.get({ method: Method.Get, key, path });

		if (data === undefined) {
			payload.error = new SQLiteProviderError({
				identifier: JoshProvider.CommonIdentifiers.PushMissingData,
				message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Push
			});

			return payload;
		}

		if (!Array.isArray(data)) {
			payload.error = new SQLiteProviderError({
				identifier: JoshProvider.CommonIdentifiers.PushInvalidType,
				message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" does not exist.`,
				method: Method.Push
			});

			return payload;
		}

		data.push(value);

		this.set({ method: Method.Set, key, path, value: data });

		return payload;
	}

	public [Method.Random](payload: RandomPayload<StoredValue>): RandomPayload<StoredValue> {
		// TODO : This should be configurable in josh/core. Fix after that's done.
		const count = 1;
		const docs = this.db.prepare(`SELECT * FROM '${this.name}' WHERE path='::NULL::' ORDER BY RANDOM() LIMIT ${Number(count)};`).all();

		payload.data = docs.length > 0 ? docs[0].value : undefined;
		/*
		TODO: Enable when more than one random value is possible:
		return data.reduce((acc, row) => {
      acc[row.key] = this.parseData(row.value);
      return acc;
    }, {});
		*/

		return payload;
	}

	public [Method.RandomKey](payload: RandomKeyPayload): RandomKeyPayload {
		// TODO: Don't forget me when fixing random() above.
		const count = 1;
		const docs = this.db.prepare(`SELECT key FROM '${this.name}' WHERE path='::NULL::' ORDER BY RANDOM() LIMIT ${Number(count)};`).all();

		payload.data = docs.length > 0 ? docs[0].key : undefined;
		// data.map((row) => row.key);

		return payload;
	}

	public [Method.Remove]<HookValue = StoredValue>(payload: RemoveByHookPayload<HookValue>): RemoveByHookPayload<HookValue>;
	public [Method.Remove](payload: RemoveByValuePayload): RemoveByValuePayload;
	public [Method.Remove]<HookValue = StoredValue>(payload: RemovePayload<HookValue>): RemovePayload<HookValue> {
		if (isRemoveByHookPayload(payload)) {
			const { key, path, hook } = payload;
			const { data } = this.get<unknown[]>({ method: Method.Get, key, path });

			if (data === undefined) {
				payload.error = new SQLiteProviderError({
					identifier: JoshProvider.CommonIdentifiers.RemoveMissingData,
					message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
					method: Method.Remove
				});

				return payload;
			}

			if (!Array.isArray(data)) {
				payload.error = new SQLiteProviderError({
					identifier: JoshProvider.CommonIdentifiers.RemoveInvalidType,
					message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" must be an array.`,
					method: Method.Remove
				});

				return payload;
			}

			const filterValues = Promise.all(data.map(hook));

			this.set({ method: Method.Set, key, path, value: data.filter((_, index) => !filterValues[index]) });
		}

		if (isRemoveByValuePayload(payload)) {
			const { key, path, value } = payload;
			const { data } = this.get({ method: Method.Get, key, path });

			if (data === undefined) {
				payload.error = new SQLiteProviderError({
					identifier: JoshProvider.CommonIdentifiers.RemoveMissingData,
					message: path.length === 0 ? `The data at "${key}" does not exist.` : `The data at "${key}.${path.join('.')}" does not exist.`,
					method: Method.Remove
				});

				return payload;
			}

			if (!Array.isArray(data)) {
				payload.error = new SQLiteProviderError({
					identifier: JoshProvider.CommonIdentifiers.RemoveInvalidType,
					message: path.length === 0 ? `The data at "${key}" must be an array.` : `The data at "${key}.${path.join('.')}" must be an array.`,
					method: Method.Remove
				});

				return payload;
			}

			this.set({ method: Method.Set, key, path, value: data.filter((storedValue) => value !== storedValue) });
		}

		return payload;
	}

	public [Method.Set]<Value = StoredValue>(payload: SetPayload<Value>): SetPayload<Value> {
		const executions = this.compareData(payload);

		this.runMany(executions);

		return payload;
	}

	public [Method.SetMany]<Value = StoredValue>(payload: SetManyPayload<Value>): SetManyPayload<Value> {
		const { data } = payload;
		const overwrite = false;

		const existingKeys = this.keys({ method: Method.Keys, data: [] }).data;

		this.runMany(
			Object.entries(data)
				.flat()
				.filter(([key]) => overwrite || !existingKeys.includes(key))
				.map(([key, value]) => this.compareData({ key, value, path: null }))
		);
		// for (const [{ key, path }, value] of data) await this.set<Value>({ method: Method.Set, key, path, value });

		return payload;
	}

	public [Method.Size](payload: SizePayload): SizePayload {
		const data = this.db.prepare(`SELECT count(*) FROM '${this.name}' WHERE path='::NULL::';`).get();

		payload.data = data['count(*)'];

		return payload;
	}

	public [Method.Some](payload: SomeByHookPayload<StoredValue>): SomeByHookPayload<StoredValue>;
	public [Method.Some](payload: SomeByValuePayload): SomeByValuePayload;
	public [Method.Some](payload: SomePayload<StoredValue>): SomePayload<StoredValue> {
		if (isSomeByHookPayload(payload)) {
			const { hook } = payload;

			for (const value of this.values({ method: Method.Values, data: [] }).data) {
				const someValue = hook(value);

				if (!someValue) continue;

				payload.data = true;

				break;
			}
		}

		if (isSomeByValuePayload(payload)) {
			const { path, value } = payload;

			for (const storedValue of this.values({ method: Method.Values, data: [] }).data) {
				if (path.length !== 0 && value !== getFromObject(storedValue, path)) continue;
				if (isPrimitive(storedValue) && value === storedValue) continue;

				payload.data = true;
			}
		}

		return payload;
	}

	public [Method.Update]<HookValue = StoredValue, Value = HookValue>(
		payload: UpdatePayload<StoredValue, HookValue, Value>
	): UpdatePayload<StoredValue, HookValue, Value> {
		const { key, path, hook } = payload;
		const { data } = this.get<HookValue>({ method: Method.Get, key, path });

		if (data === undefined) return payload;

		Reflect.set(payload, 'data', hook(data));
		this.set({ method: Method.Set, key, path, value: payload.data });

		return payload;
	}

	public [Method.Values](payload: ValuesPayload<StoredValue>): ValuesPayload<StoredValue> {
		const docs = this.db.prepare(`SELECT value FROM '${this.name}' WHERE path='::NULL::';`).all();

		// @ts-expect-error 2345
		for (const doc of docs) payload.data.push(this.parseData(doc.value));

		return payload;
	}

	private validateName() {
		this.name = this.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
	}

	private get db(): Database.Database {
		if (isNullOrUndefined(this._db))
			throw new JoshError({
				message: 'Database has not been initialized, probably due to `init` not being called.',
				identifier: SQLiteProvider.Identifiers.NotInitialized
			});

		return this._db;
	}

	// public async [Method.Set]<Value = StoredValue>(payload: SetPayload<Value>): Promise<SetPayload<Value>> {
	private compareData(payload: SQLiteProvider.compareDataPayload): any[] {
		const { key, path, value } = payload;
		const executions = [];
		const currentData = this.has({ method: Method.Has, key, path, data: false }).data ? this.get({ method: Method.Get, key, path }) : '::NULL::';
		const currentPaths = this.getPaths(currentData);
		const paths = path ? this.getPaths(setToObject(deepClone(currentData), path, value)) : this.getPaths(value);

		for (const [currentPath, value] of Object.entries(currentPaths)) {
			if (isNullOrUndefined(paths[currentPath]) || paths[currentPath] !== value) {
				executions.push([this.deleteStmt, { key, path: currentPath }]);

				if (isNullOrUndefined(paths[currentPath])) {
					executions.push([this.insertStmt, { key, path: currentPath, value: paths[currentPath] }]);
				}
			}

			delete paths[currentPath];
		}
		for (const [currentPath, value] of Object.entries(paths)) {
			executions.push([this.insertStmt, { key, path: currentPath, value }]);
		}

		return executions;
	}

	private serializeData(data: any) {
		let serialized;

		try {
			serialized = serialize(onChange.target(data));
		} catch (err) {
			serialized = serialize(data);
		}

		return serialized;
	}

	private getDelimitedPath(base: unknown, key: string, parentIsArray: boolean) {
		return parentIsArray ? (base ? `${base}[${key}]` : key) : base ? `${base}.${key}` : key;
	}

	private getPaths(data: any, acc = {}, basePath = null) {
		if (data === '::NULL::') return {};
		if (!isObject(data)) {
			acc[basePath || '::NULL::'] = this.serializeData(data);

			return acc;
		}

		const source = Array.isArray(data) ? data.map((da, i) => [i, da]) : Object.entries(data);
		const returnPaths = source.reduce((paths, [key, value]) => {
			const path = this.getDelimitedPath(basePath, key, Array.isArray(data));

			if (isObject(value)) this.getPaths(value, paths, path);

			paths[path.toString()] = this.serializeData(value);

			return paths;
		}, acc || {});

		return basePath ? returnPaths : { ...returnPaths, '::NULL::': this.serializeData(data) };
	}

	private parseData(data: string) {
		try {
			return eval(`(${data})`);
		} catch (err) {
			console.log('Error parsing data : ', err);

			return null;
		}
	}
}

export namespace SQLiteProvider {
	export interface Options extends JoshProvider.Options {
		name: string;
		dataDir?: string;
		inMemory?: boolean;
		wal?: boolean;
	}
	export enum Identifiers {
		InitFileNotFound = 'initFileNotFound',

		NotInitialized = 'notInitialized'
	}
	export interface compareDataPayload {
		key: string;
		value: unknown;
		path: string[] | null;
	}
}
