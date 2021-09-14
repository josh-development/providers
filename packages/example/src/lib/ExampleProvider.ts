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
	JoshProvider,
	KeysPayload,
	MapByHookPayload,
	MapByPathPayload,
	MapPayload,
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

export class ExampleProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
	public [Method.AutoKey](payload: AutoKeyPayload): AutoKeyPayload {
		return payload;
	}

	public [Method.Clear](payload: ClearPayload): ClearPayload {
		return payload;
	}

	public [Method.Dec](payload: DecPayload): DecPayload {
		return payload;
	}

	public [Method.Delete](payload: DeletePayload): DeletePayload {
		return payload;
	}

	public [Method.Ensure](payload: EnsurePayload<StoredValue>): EnsurePayload<StoredValue> {
		return payload;
	}

	public [Method.Every]<HookValue>(payload: EveryByHookPayload<HookValue>): EveryByHookPayload<HookValue>;

	public [Method.Every]<Value>(payload: EveryByValuePayload): EveryByValuePayload;
	public [Method.Every]<HookValue>(payload: EveryPayload<HookValue>): EveryPayload<HookValue> {
		return payload;
	}

	public [Method.Filter](payload: FilterByHookPayload<StoredValue>): FilterByHookPayload<StoredValue>;

	public [Method.Filter](payload: FilterByValuePayload<StoredValue>): FilterByValuePayload<StoredValue>;
	public [Method.Filter](payload: FilterPayload<StoredValue>): FilterPayload<StoredValue> {
		return payload;
	}

	public [Method.Find](payload: FindByHookPayload<StoredValue>): FindByHookPayload<StoredValue>;

	public [Method.Find](payload: FindByValuePayload<StoredValue>): FindByValuePayload<StoredValue>;
	public [Method.Find](payload: FindPayload<StoredValue>): FindPayload<StoredValue> {
		return payload;
	}

	public [Method.Get]<DataValue>(payload: GetPayload<DataValue>): GetPayload<DataValue> {
		return payload;
	}

	public [Method.GetAll](payload: GetAllPayload<StoredValue>): GetAllPayload<StoredValue> {
		return payload;
	}

	public [Method.GetMany](payload: GetManyPayload<StoredValue>): GetManyPayload<StoredValue> {
		return payload;
	}

	public [Method.Has](payload: HasPayload): HasPayload {
		return payload;
	}

	public [Method.Inc](payload: IncPayload): IncPayload {
		return payload;
	}

	public [Method.Keys](payload: KeysPayload): KeysPayload {
		return payload;
	}

	public [Method.Map]<Value, HookValue>(payload: MapByHookPayload<Value, HookValue>): MapByHookPayload<Value, HookValue>;

	public [Method.Map]<Value = StoredValue>(payload: MapByPathPayload<Value>): MapByPathPayload<Value>;
	public [Method.Map]<Value = StoredValue, HookValue = Value>(payload: MapPayload<Value, HookValue>): MapPayload<Value, HookValue> {
		return payload;
	}

	public [Method.Partition](payload: PartitionByHookPayload<StoredValue>): PartitionByHookPayload<StoredValue>;

	public [Method.Partition](payload: PartitionByValuePayload<StoredValue>): PartitionByValuePayload<StoredValue>;
	public [Method.Partition](payload: PartitionPayload<StoredValue>): PartitionPayload<StoredValue> {
		return payload;
	}

	public [Method.Push]<Value>(payload: PushPayload<Value>): PushPayload<Value> {
		return payload;
	}

	public [Method.Random](payload: RandomPayload<StoredValue>): RandomPayload<StoredValue> {
		return payload;
	}

	public [Method.RandomKey](payload: RandomKeyPayload): RandomKeyPayload {
		return payload;
	}

	public [Method.Remove]<HookValue>(payload: RemoveByHookPayload<HookValue>): RemoveByHookPayload<HookValue>;

	public [Method.Remove]<Value>(payload: RemoveByValuePayload): RemoveByValuePayload;
	public [Method.Remove]<HookValue>(payload: RemovePayload<HookValue>): RemovePayload<HookValue> {
		return payload;
	}

	public [Method.Set]<Value = StoredValue>(payload: SetPayload<Value>): SetPayload<Value> {
		return payload;
	}

	public [Method.SetMany](payload: SetManyPayload<StoredValue>): SetManyPayload<StoredValue> {
		return payload;
	}

	public [Method.Size](payload: SizePayload): SizePayload {
		return payload;
	}

	public [Method.Some]<HookValue>(payload: SomeByHookPayload<HookValue>): SomeByHookPayload<HookValue>;

	public [Method.Some]<Value>(payload: SomeByValuePayload): SomeByValuePayload;
	public [Method.Some]<HookValue>(payload: SomePayload<HookValue>): SomePayload<HookValue> {
		return payload;
	}

	public [Method.Update]<Value, HookValue>(payload: UpdatePayload<StoredValue, Value, HookValue>): UpdatePayload<StoredValue, Value, HookValue> {
		return payload;
	}

	public [Method.Values](payload: ValuesPayload<StoredValue>): ValuesPayload<StoredValue> {
		return payload;
	}
}
