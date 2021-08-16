import {
	AutoKeyPayload,
	DecPayload,
	DeletePayload,
	EnsurePayload,
	FilterByDataPayload,
	FilterByHookPayload,
	FindByDataPayload,
	FindByHookPayload,
	GetAllPayload,
	GetManyPayload,
	GetPayload,
	HasPayload,
	IncPayload,
	JoshProvider,
	KeysPayload,
	PushPayload,
	RandomKeyPayload,
	RandomPayload,
	SetManyPayload,
	SetPayload,
	SizePayload,
	SomeByDataPayload,
	SomeByHookPayload,
	UpdateByDataPayload,
	UpdateByHookPayload,
	ValuesPayload
} from '@joshdb/core';

export class ExampleProvider<Value = unknown> extends JoshProvider<Value> {
	public autoKey(payload: AutoKeyPayload): AutoKeyPayload {
		return payload;
	}

	public dec(payload: DecPayload): DecPayload {
		return payload;
	}

	public delete(payload: DeletePayload): DeletePayload {
		return payload;
	}

	public ensure<CustomValue = Value>(payload: EnsurePayload<CustomValue>): EnsurePayload<CustomValue> {
		return payload;
	}

	public filterByData<CustomValue = Value>(payload: FilterByDataPayload<CustomValue>): FilterByDataPayload<CustomValue> {
		return payload;
	}

	public filterByHook<CustomValue = Value>(payload: FilterByHookPayload<CustomValue>): FilterByHookPayload<CustomValue> {
		return payload;
	}

	public findByData<CustomValue = Value>(payload: FindByDataPayload<CustomValue>): FindByDataPayload<CustomValue> {
		return payload;
	}

	public findByHook<CustomValue = Value>(payload: FindByHookPayload<CustomValue>): FindByHookPayload<CustomValue> {
		return payload;
	}

	public get<CustomValue = Value>(payload: GetPayload<CustomValue>): GetPayload<CustomValue> {
		return payload;
	}

	public getAll<CustomValue = Value>(payload: GetAllPayload<CustomValue>): GetAllPayload<CustomValue> {
		return payload;
	}

	public getMany<CustomValue = Value>(payload: GetManyPayload<CustomValue>): GetManyPayload<CustomValue> {
		return payload;
	}

	public has(payload: HasPayload): HasPayload {
		return payload;
	}

	public inc(payload: IncPayload): IncPayload {
		return payload;
	}

	public keys(payload: KeysPayload): KeysPayload {
		return payload;
	}

	public push<CustomValue = Value>(payload: PushPayload, _value: CustomValue): PushPayload {
		return payload;
	}

	public random<CustomValue = Value>(payload: RandomPayload<CustomValue>): RandomPayload<CustomValue> {
		return payload;
	}

	public randomKey(payload: RandomKeyPayload): RandomKeyPayload {
		return payload;
	}

	public set<CustomValue = Value>(payload: SetPayload, _value: CustomValue): SetPayload {
		return payload;
	}

	public setMany<CustomValue = Value>(payload: SetManyPayload, _value: CustomValue): SetManyPayload {
		return payload;
	}

	public size(payload: SizePayload): SizePayload {
		return payload;
	}

	public someByData<CustomValue = Value>(payload: SomeByDataPayload<CustomValue>): SomeByDataPayload<CustomValue> {
		return payload;
	}

	public someByHook<CustomValue = Value>(payload: SomeByHookPayload<CustomValue>): SomeByHookPayload<CustomValue> {
		return payload;
	}

	public updateByData<CustomValue = Value>(payload: UpdateByDataPayload<CustomValue>): UpdateByDataPayload<CustomValue> {
		return payload;
	}

	public updateByHook<CustomValue = Value>(payload: UpdateByHookPayload<CustomValue>): UpdateByHookPayload<CustomValue> {
		return payload;
	}

	public values<CustomValue = Value>(payload: ValuesPayload<CustomValue>): ValuesPayload<CustomValue> {
		return payload;
	}
}
