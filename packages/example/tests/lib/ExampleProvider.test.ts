import { Method, Payload } from '@joshdb/core';
import { ExampleProvider } from '../../src';

const provider = new ExampleProvider({ name: 'tests' });

describe('ExampleProviderClass', () => {
	describe('Initialization', () => {
		test('GIVEN init() THEN returns true', () => {
			void expect(provider.init()).resolves.toBe(true);
		});

		test('GIVEN name THEN returns provider name', () => {
			expect(provider.name).toBe('tests');
		});
	});

	describe('Payload validation', () => {
		test('GIVEN autoKey() THEN returns payload for autoKey', () => {
			const { method, trigger, stopwatch, data } = provider.autoKey({ method: Method.AutoKey, data: '' });

			expect(method).toBe(Method.AutoKey);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(data).toBe('');
		});

		test('GIVEN dec() THEN returns payload for dec', () => {
			const { method, trigger, stopwatch, key, path, data } = provider.dec({ method: Method.Dec, key: '' });

			expect(method).toBe(Method.Dec);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
			expect(path).toBeUndefined();
			expect(data).toBeUndefined();
		});

		test('GIVEN delete() THEN returns payload for delete', () => {
			const { method, trigger, stopwatch, key, path } = provider.delete({ method: Method.Delete, key: '' });

			expect(method).toBe(Method.Delete);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
			expect(path).toBeUndefined();
		});

		test('GIVEN ensure() THEN returns payload for ensure', () => {
			const { method, trigger, stopwatch, key, data, defaultValue } = provider.ensure({ method: Method.Ensure, key: '', data: '', defaultValue: '' });

			expect(method).toBe(Method.Ensure);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
			expect(data).toBe('');
			expect(defaultValue).toBe('');
		});

		test('GIVEN filterByData() THEN returns payload for filterByData', () => {
			const { method, trigger, stopwatch, type, path, inputData, data } = provider.filterByData({
				method: Method.Filter,
				type: Payload.Type.Data,
				inputData: '',
				data: {}
			});

			expect(method).toBe(Method.Filter);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(type).toBe(Payload.Type.Data);
			expect(path).toBeUndefined();
			expect(inputData).toBe('');
			expect(data).toEqual({});
		});

		test('GIVEN filterByHook() THEN returns payload for filterByHook', () => {
			const { method, trigger, stopwatch, type, path, inputHook, data } = provider.filterByHook({
				method: Method.Filter,
				type: Payload.Type.Hook,
				inputHook: () => true,
				data: {}
			});

			expect(method).toBe(Method.Filter);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(type).toBe(Payload.Type.Hook);
			expect(path).toBeUndefined();
			expect(typeof inputHook).toBe('function');
			expect(data).toEqual({});
		});

		test('GIVEN findByData() THEN returns payload for findByData', () => {
			const { method, trigger, stopwatch, type, path, inputData, data } = provider.findByData({
				method: Method.Find,
				type: Payload.Type.Data,
				inputData: ''
			});

			expect(method).toBe(Method.Find);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(type).toBe(Payload.Type.Data);
			expect(path).toBeUndefined();
			expect(inputData).toBe('');
			expect(data).toBeUndefined();
		});

		test('GIVEN findByHook() THEN returns payload for findByHook', () => {
			const { method, trigger, stopwatch, type, path, inputHook, data } = provider.findByHook({
				method: Method.Find,
				type: Payload.Type.Hook,
				inputHook: () => true
			});

			expect(method).toBe(Method.Find);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(type).toBe(Payload.Type.Hook);
			expect(path).toBeUndefined();
			expect(typeof inputHook).toBe('function');
			expect(data).toBeUndefined();
		});

		test('GIVEN get() THEN returns payload for get', () => {
			const { method, trigger, stopwatch, key, path, data } = provider.get({ method: Method.Get, key: '' });

			expect(method).toBe(Method.Get);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
			expect(path).toBeUndefined();
			expect(data).toBeUndefined();
		});

		test('GIVEN getAll() THEN returns payload for getAll', () => {
			const { method, trigger, stopwatch, data } = provider.getAll({ method: Method.GetAll, data: {} });

			expect(method).toBe(Method.GetAll);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(data).toEqual({});
		});

		test('GIVEN getMany() THEN returns payload for getMany', () => {
			const { method, trigger, stopwatch, keyPaths, data } = provider.getMany({ method: Method.GetMany, keyPaths: [], data: {} });

			expect(method).toBe(Method.GetMany);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(keyPaths).toEqual([]);
			expect(data).toEqual({});
		});

		test('GIVEN has() THEN returns payload for has', () => {
			const { method, trigger, stopwatch, key, path, data } = provider.has({ method: Method.Has, key: '', data: false });

			expect(method).toBe(Method.Has);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
			expect(path).toBeUndefined();
			expect(data).toBe(false);
		});

		test('GIVEN keys() THEN returns payload for keys', () => {
			const { method, trigger, stopwatch, data } = provider.keys({ method: Method.Keys, data: [] });

			expect(method).toBe(Method.Keys);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(data).toEqual([]);
		});

		test('GIVEN push() THEN returns payload for push', () => {
			const { method, trigger, stopwatch, key } = provider.push({ method: Method.Push, key: '' }, '');

			expect(method).toBe(Method.Push);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
		});

		test('GIVEN random() THEN returns payload for random', () => {
			const { method, trigger, stopwatch, data } = provider.random({ method: Method.Random });

			expect(method).toBe(Method.Random);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(data).toBeUndefined();
		});

		test('GIVEN randomKey() THEN returns payload for randomKey', () => {
			const { method, trigger, stopwatch, data } = provider.randomKey({ method: Method.RandomKey });

			expect(method).toBe(Method.RandomKey);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(data).toBeUndefined();
		});

		test('GIVEN set() THEN returns payload for set', () => {
			const { method, trigger, stopwatch, key, path } = provider.set({ method: Method.Set, key: '' }, '');

			expect(method).toBe(Method.Set);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
			expect(path).toBeUndefined();
		});

		test('GIVEN setMany() THEN returns payload for setMany', () => {
			const { method, trigger, stopwatch, keyPaths } = provider.setMany({ method: Method.SetMany, keyPaths: [] }, '');

			expect(method).toBe(Method.SetMany);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(keyPaths).toEqual([]);
		});

		test('GIVEN size() THEN returns payload for size', () => {
			const { method, trigger, stopwatch, data } = provider.size({ method: Method.Size, data: 0 });

			expect(method).toBe(Method.Size);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(data).toBe(0);
		});

		test('GIVEN someByData() THEN returns payload for someByData', () => {
			const { method, trigger, stopwatch, path, inputData, data } = provider.someByData({
				method: Method.Find,
				type: Payload.Type.Data,
				inputData: '',
				data: false
			});

			expect(method).toBe(Method.Find);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(path).toBeUndefined();
			expect(inputData).toBe('');
			expect(data).toBe(false);
		});

		test('GIVEN someByHook() THEN returns payload for someByHook', () => {
			const { method, trigger, stopwatch, path, inputHook, data } = provider.someByHook({
				method: Method.Find,
				type: Payload.Type.Hook,
				inputHook: () => true,
				data: false
			});

			expect(method).toBe(Method.Find);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(path).toBeUndefined();
			expect(typeof inputHook).toBe('function');
			expect(data).toBe(false);
		});

		test('GIVEN updateByData() THEN returns payload for updateByData', () => {
			const { method, trigger, stopwatch, key, path, inputData, data } = provider.updateByData({
				method: Method.Update,
				type: Payload.Type.Data,
				key: '',
				inputData: ''
			});

			expect(method).toBe(Method.Update);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
			expect(path).toBeUndefined();
			expect(inputData).toBe('');
			expect(data).toBeUndefined();
		});

		test('GIVEN updateByHook() THEN returns payload for updateByHook', () => {
			const { method, trigger, stopwatch, key, path, inputHook, data } = provider.updateByHook({
				method: Method.Update,
				type: Payload.Type.Hook,
				key: '',
				inputHook: () => ''
			});

			expect(method).toBe(Method.Update);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(key).toBe('');
			expect(path).toBeUndefined();
			expect(typeof inputHook).toBe('function');
			expect(data).toBeUndefined();
		});

		test('GIVEN values() THEN returns payload for values', () => {
			const { method, trigger, stopwatch, data } = provider.values({ method: Method.Values, data: [] });

			expect(method).toBe(Method.Values);
			expect(trigger).toBeUndefined();
			expect(stopwatch).toBeUndefined();
			expect(data).toEqual([]);
		});
	});
});
