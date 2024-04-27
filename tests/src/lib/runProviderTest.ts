import { CommonIdentifiers, JoshProvider, MathOperator, Method, Payload, doMath } from '@joshdb/provider';
import type { Awaitable, Constructor } from '@sapphire/utilities';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Executes tests for a given provider.
 * @since 1.0.0
 * @param options The options for the test.
 */
export function runProviderTest<
  Provider extends Constructor<JoshProvider>,
  Options extends JoshProvider.Options = JoshProvider.Options,
  CleanupProvider extends JoshProvider = JoshProvider
>(options: ProviderTestOptions<Provider, Options, CleanupProvider>): void {
  const { providerConstructor: Provider, providerOptions = {}, cleanup, serialization = true } = options;

  for (const serialize of serialization ? [true, false] : [true]) {
    describe(`${Provider.prototype.constructor.name} - Serialization ${serialize ? 'Enabled' : 'Disabled'}`, () => {
      describe('is a class', () => {
        test(`GIVEN typeof ${Provider.prototype.constructor.name} THEN returns function`, () => {
          expect(typeof Provider).toBe('function');
        });

        test('GIVEN typeof ...prototype THEN returns object', () => {
          expect(typeof Provider.prototype).toBe('object');
        });
      });

      describe('can manipulate provider data', () => {
        const provider = new Provider({ ...providerOptions, disableSerialization: !serialize });

        beforeAll(async () => {
          await provider.init({ name: 'provider' });
        });

        beforeEach(async () => {
          await provider[Method.Clear]({ method: Method.Clear, errors: [] });
        });

        afterAll(async () => {
          await provider[Method.Clear]({ method: Method.Clear, errors: [] });
          if (typeof cleanup === 'function') {
            await cleanup(provider as CleanupProvider);
          }
        });

        describe(Method.AutoKey, () => {
          test('GIVEN ... THEN returns payload w/ generated key as data AND increments autoKeyCount', async () => {
            const payload = await provider[Method.AutoKey]({ method: Method.AutoKey, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.AutoKey);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(typeof data).toBe('string');
          });

          test('each value of autoKey should be unique', async () => {
            const arr = await Promise.all(
              [...Array(10)].map(async () => (await provider[Method.AutoKey]({ method: Method.AutoKey, errors: [] })).data)
            );

            const isUnique = new Set(arr).size === arr.length;

            expect(isUnique).toBe(true);
          });
        });

        describe(Method.Clear, () => {
          test('GIVEN provider w/o data THEN provider data cleared', async () => {
            const sizeBefore = await provider[Method.Size]({ method: Method.Size, errors: [] });

            expect(sizeBefore.data).toBe(0);

            const payload = await provider[Method.Clear]({ method: Method.Clear, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors } = payload;

            expect(method).toBe(Method.Clear);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);

            const sizeAfter = await provider[Method.Size]({ method: Method.Size, errors: [] });

            expect(sizeAfter.data).toBe(0);
          });

          test('GIVEN provider w/ data THEN provider data cleared', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const sizeBefore = await provider[Method.Size]({ method: Method.Size, errors: [] });

            expect(sizeBefore.data).toBe(1);

            const payload = await provider[Method.Clear]({ method: Method.Clear, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors } = payload;

            expect(method).toBe(Method.Clear);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);

            const sizeAfter = await provider[Method.Size]({ method: Method.Size, errors: [] });

            expect(sizeAfter.data).toBe(0);
          });
        });

        describe(Method.Dec, () => {
          test('GIVEN provider w/o data at key THEN returns payload w/ missing data error', async () => {
            const payload = await provider[Method.Dec]({ method: Method.Dec, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Dec);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(path).toEqual([]);
          });

          test('GIVEN provider w/o data at path THEN returns payload w/ missing data error', async () => {
            const payload = await provider[Method.Dec]({ method: Method.Dec, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Dec);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
          });

          test('GIVEN provider w/ invalid type at key THEN returns payload w/ invalid type error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Dec]({ method: Method.Dec, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Dec);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
            expect(key).toBe('key');
            expect(path).toEqual([]);
          });

          test('GIVEN provider w/ invalid type at path THEN returns payload w/ invalid type error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            const payload = await provider[Method.Dec]({ method: Method.Dec, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Dec);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
          });

          test('GIVEN provider w/ number at key THEN decremented number at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 1 });

            const payload = await provider[Method.Dec]({ method: Method.Dec, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Dec);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual([]);

            const get = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

            expect(get.data).toEqual(0);
          });

          test('GIVEN provider w/ number at path THEN decremented number at path', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 1 });

            const payload = await provider[Method.Dec]({ method: Method.Dec, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Dec);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);

            const get = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: ['path'] });

            expect(get.data).toEqual(0);
          });
        });

        describe(Method.Delete, () => {
          test('GIVEN provider w/ value at key THEN deletes value at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasBefore.data).toBe(true);

            const payload = await provider[Method.Delete]({ method: Method.Delete, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors } = payload;

            expect(method).toBe(Method.Delete);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);

            const hasAfter = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasAfter.data).toBe(false);
          });

          test('GIVEN provider w/ value at path THEN deletes value at path', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: ['path'] });

            expect(hasBefore.data).toBe(true);

            const payload = await provider[Method.Delete]({ method: Method.Delete, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors } = payload;

            expect(method).toBe(Method.Delete);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);

            const hasAfter = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: ['path'] });

            expect(hasAfter.data).toBe(false);
          });

          test('GIVEN provider w/ value at nested path THEN deletes value at nested path', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path', 'nested'], value: 'value' });

            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: ['path', 'nested'] });

            expect(hasBefore.data).toBe(true);

            const payload = await provider[Method.Delete]({ method: Method.Delete, errors: [], key: 'key', path: ['path', 'nested'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors } = payload;

            expect(method).toBe(Method.Delete);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);

            const hasAfter = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: ['path', 'nested'] });

            expect(hasAfter.data).toBe(false);
          });
        });

        describe(Method.DeleteMany, () => {
          test('GIVEN provider w/o value at key THEN does nothing', async () => {
            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasBefore.data).toBe(false);

            const payload = await provider[Method.DeleteMany]({ method: Method.DeleteMany, errors: [], keys: ['key'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors } = payload;

            expect(method).toBe(Method.DeleteMany);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);

            const hasAfter = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasAfter.data).toBe(false);
          });

          test('GIVEN provider w/ value at key THEN deletes value at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasBefore.data).toBe(true);

            const payload = await provider[Method.DeleteMany]({ method: Method.DeleteMany, errors: [], keys: ['key'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors } = payload;

            expect(method).toBe(Method.DeleteMany);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);

            const hasAfter = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasAfter.data).toBe(false);
          });
        });

        describe(Method.Ensure, () => {
          test('GIVEN provider w/o data at key THEN returns payload w/ data as defaultValue AND sets default value at key', async () => {
            const sizeBefore = await provider[Method.Size]({ method: Method.Size, errors: [] });

            expect(sizeBefore.data).toBe(0);

            const payload = await provider[Method.Ensure]({ method: Method.Ensure, errors: [], key: 'key', defaultValue: 'defaultValue' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, defaultValue, data } = payload;

            expect(method).toBe(Method.Ensure);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(defaultValue).toBe('defaultValue');
            expect(data).toBe('defaultValue');

            const sizeAfter = await provider[Method.Size]({ method: Method.Size, errors: [] });

            expect(sizeAfter.data).toBe(1);
          });

          test('GIVEN provider w/ value at key THEN returns payload w/ data as value at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Ensure]({ method: Method.Ensure, errors: [], key: 'key', defaultValue: 'defaultValue' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, defaultValue, data } = payload;

            expect(method).toBe(Method.Ensure);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(defaultValue).toBe('defaultValue');
            expect(data).toBe('value');
          });
        });

        describe(Method.Entries, () => {
          test('GIVEN provider w/o data THEN returns payload w/o data from getAll', async () => {
            const payload = await provider.entries({ method: Method.Entries, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.Entries);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(data).toEqual({});
          });

          test('GIVEN provider w/ data THEN returns payload w/ data from getAll', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider.entries({ method: Method.Entries, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.Entries);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(data).toEqual({ key: 'value' });
          });
        });

        describe(Method.Every, () => {
          describe(Payload.Type.Hook.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload(true)', async () => {
              const payload = await provider[Method.Every]({
                method: Method.Every,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Every);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toBe(true);
            });

            test('GIVEN provider w/ data THEN returns payload(true)', async () => {
              await provider[Method.SetMany]({
                method: Method.SetMany,
                errors: [],
                entries: [
                  { key: 'firsKey', path: [], value: 'value' },
                  { key: 'secondKey', path: [], value: 'value' }
                ],
                overwrite: true
              });

              const payload = await provider[Method.Every]({
                method: Method.Every,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Every);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toBe(true);
            });
          });

          describe(Payload.Type.Value.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload(true)', async () => {
              const payload = await provider[Method.Every]({
                method: Method.Every,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Every);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toBe(true);
            });

            test('GIVEN provider w/ data THEN returns payload(true)', async () => {
              await provider[Method.SetMany]({
                method: Method.SetMany,
                errors: [],
                entries: [
                  { key: 'firsKey', path: [], value: 'value' },
                  { key: 'secondKey', path: [], value: 'value' }
                ],
                overwrite: true
              });

              const payload = await provider[Method.Every]({
                method: Method.Every,
                errors: [],
                type: Payload.Type.Value,
                path: [],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Every);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual([]);
              expect(value).toBe('value');
              expect(data).toBe(true);
            });

            test('GIVEN provider w/ data w/ wrong path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: {} });

              const payload = await provider[Method.Every]({
                method: Method.Every,
                errors: [],
                type: Payload.Type.Value,
                path: ['invalid'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Every);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
              expect(path).toEqual(['invalid']);
              expect(value).toBe('value');
              expect(data).toBe(true);
            });

            test('GIVEN provider w/ data w/ invalid primitive at path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: { p: {} } });

              const payload = await provider[Method.Every]({
                method: Method.Every,
                errors: [],
                type: Payload.Type.Value,
                path: ['p'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Every);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
              expect(path).toEqual(['p']);
              expect(value).toBe('value');
              expect(data).toBe(true);
            });

            test('GIVEN provider w/o data w/o path THEN returns payload(true)', async () => {
              const payload = await provider[Method.Every]({ method: Method.Every, errors: [], type: Payload.Type.Value, path: [], value: 'value' });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Every);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual([]);
              expect(value).toBe('value');
              expect(data).toBe(true);
            });

            test('GIVEN provider w/ data w/o path THEN returns payload(true)', async () => {
              await provider[Method.SetMany]({
                method: Method.SetMany,
                errors: [],
                entries: [
                  { key: 'firsKey', path: [], value: 'value' },
                  { key: 'secondKey', path: [], value: 'value' }
                ],
                overwrite: true
              });

              const payload = await provider[Method.Every]({ method: Method.Every, errors: [], type: Payload.Type.Value, path: [], value: 'value' });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Every);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual([]);
              expect(value).toBe('value');
              expect(data).toBe(true);
            });
          });
        });

        describe(Method.Filter, () => {
          describe(Payload.Type.Hook.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload w/o data from filter', async () => {
              const payload = await provider[Method.Filter]({
                method: Method.Filter,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Filter);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toEqual({});
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from filter', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Filter]({
                method: Method.Filter,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Filter);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toEqual({ key: 'value' });
            });
          });

          describe(Payload.Type.Value.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload w/o data from filter', async () => {
              const payload = await provider[Method.Filter]({
                method: Method.Filter,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Filter);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toEqual({});
            });

            test('GIVEN provider w/ data w/ invalid path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

              const payload = await provider[Method.Filter]({
                method: Method.Filter,
                errors: [],
                type: Payload.Type.Value,
                path: ['invalid'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Filter);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
              expect(path).toEqual(['invalid']);
              expect(value).toBe('value');
              expect(data).toEqual({});
            });

            test('GIVEN provider w/ data w/ invalid path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: {} });

              const payload = await provider[Method.Filter]({
                method: Method.Filter,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Filter);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toEqual({});
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from filter', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

              const payload = await provider[Method.Filter]({
                method: Method.Filter,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Filter);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toEqual({ key: { path: 'value' } });
            });
          });
        });

        describe(Method.Find, () => {
          describe(Payload.Type.Hook.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload w/o data from find', async () => {
              const payload = await provider[Method.Find]({
                method: Method.Find,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });
              expect(method).toBe(Method.Find);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toEqual([null, null]);
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from find', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Find]({
                method: Method.Find,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Find);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toEqual(['key', 'value']);
            });
          });

          describe(Payload.Type.Value.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload w/o data from find', async () => {
              const payload = await provider[Method.Find]({
                method: Method.Find,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Find);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toEqual([null, null]);
            });

            test('GIVEN provider w/ data w/ invalid path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

              const payload = await provider[Method.Find]({
                method: Method.Find,
                errors: [],
                type: Payload.Type.Value,
                path: ['invalid'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Find);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
              expect(path).toEqual(['invalid']);
              expect(value).toBe('value');
              expect(data).toEqual([null, null]);
            });

            test('GIVEN provider w/ data w/ invalid primitive at path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: {} });

              const payload = await provider[Method.Find]({
                method: Method.Find,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Find);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toEqual([null, null]);
            });

            test('GIVEN provider w/ data THEN returns payload w/o data from find', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

              const payload = await provider[Method.Find]({
                method: Method.Find,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Find);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toEqual(['key', { path: 'value' }]);
            });
          });
        });

        describe(Method.Get, () => {
          test('GIVEN provider w/o data THEN returns payload w/o data from get', async () => {
            const payload = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, data } = payload;

            expect(method).toBe(Method.Get);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(data).toBeUndefined();
          });

          test('GIVEN provider w/ value at key THEN returns payload w/ data from get at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, data } = payload;

            expect(method).toBe(Method.Get);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(data).toBe('value');
          });

          test('GIVEN provider w/ value at path THEN returns payload w/ data from get at path', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            const payload = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, data } = payload;

            expect(method).toBe(Method.Get);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(data).toBe('value');
          });
        });

        describe(Method.GetMany, () => {
          test('GIVEN provider w/o data THEN returns payload w/o data from getMany', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: null });

            const payload = await provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, keys, data } = payload;

            expect(method).toBe(Method.GetMany);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(keys).toEqual(['key']);
            expect(data).toEqual({ key: null });
          });

          test('GIVEN provider w/ data THEN returns payload w/ data from getMany', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, keys, data } = payload;

            expect(method).toBe(Method.GetMany);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(keys).toEqual(['key']);
            expect(data).toEqual({ key: 'value' });
          });
        });

        describe(Method.Has, () => {
          test('GIVEN provider w/o data at key THEN returns payload(false)', async () => {
            const payload = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, data } = payload;

            expect(method).toBe(Method.Has);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(data).toBe(false);
          });

          test('GIVEN provider w/o data at path THEN returns payload(false)', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, data } = payload;

            expect(method).toBe(Method.Has);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(data).toBe(false);
          });

          test('GIVEN provider w/ data at key THEN returns payload(true)', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, data } = payload;

            expect(method).toBe(Method.Has);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(data).toBe(true);
          });

          test('GIVEN provider w/ data at path THEN returns payload(true)', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            const payload = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, data } = payload;

            expect(method).toBe(Method.Has);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(data).toBe(true);
          });
        });

        describe(Method.Inc, () => {
          test('GIVEN provider w/o data at key THEN returns payload w/ missing data error', async () => {
            const payload = await provider[Method.Inc]({ method: Method.Inc, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Inc);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(path).toEqual([]);
          });

          test('GIVEN provider w/o data at path THEN returns payload w/ missing data error', async () => {
            const payload = await provider[Method.Inc]({ method: Method.Inc, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Inc);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
          });

          test('GIVEN provider w/ invalid type at key THEN returns payload w/ invalid type error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Inc]({ method: Method.Inc, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Inc);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
            expect(key).toBe('key');
            expect(path).toEqual([]);
          });

          test('GIVEN provider w/ invalid type at path THEN returns payload w/ invalid type error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            const payload = await provider[Method.Inc]({ method: Method.Inc, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Inc);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
          });

          test('GIVEN provider w/ number at key THEN incremented number at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 0 });

            const payload = await provider[Method.Inc]({ method: Method.Inc, errors: [], key: 'key', path: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Inc);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual([]);

            const get = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

            expect(get.data).toEqual(1);
          });

          test('GIVEN provider w/ number at path THEN incremented number at key and path', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 0 });

            const payload = await provider[Method.Inc]({ method: Method.Inc, errors: [], key: 'key', path: ['path'] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path } = payload;

            expect(method).toBe(Method.Inc);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);

            const get = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: ['path'] });

            expect(get.data).toEqual(1);
          });
        });

        describe(Method.Keys, () => {
          test('GIVEN provider w/o data THEN returns payload w/o data from keys', async () => {
            const payload = await provider[Method.Keys]({ method: Method.Keys, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.Keys);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(data).toEqual([]);
          });

          test('GIVEN provider w/ data THEN returns payload w/ data from keys', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Keys]({ method: Method.Keys, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.Keys);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(data).toEqual(['key']);
          });
        });

        describe(Method.Map, () => {
          describe(Payload.Type.Hook.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload w/o data from map', async () => {
              const payload = await provider[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Hook, hook: (value) => value });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Map);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toEqual([]);
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from map', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Hook, hook: (value) => value });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Map);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toEqual(['value']);
            });
          });

          describe(Payload.Type.Path.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload w/o data from map', async () => {
              const payload = await provider[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Path, path: [] });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, data } = payload;

              expect(method).toBe(Method.Map);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual([]);
              expect(data).toEqual([]);
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from map', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Path, path: [] });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, data } = payload;

              expect(method).toBe(Method.Map);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual([]);
              expect(data).toEqual(['value']);
            });

            test('GIVEN provider w/ data at path THEN returns payload w/ data from map', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

              const payload = await provider[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Path, path: ['path'] });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, data } = payload;

              expect(method).toBe(Method.Map);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual(['path']);
              expect(data).toEqual(['value']);
            });
          });
        });

        describe(Method.Math, () => {
          test('GIVEN provider w/o data THEN returns payload w/ error', async () => {
            const payload = await provider[Method.Math]({
              method: Method.Math,
              errors: [],
              key: 'key',
              path: [],
              operator: MathOperator.Addition,
              operand: 1
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, operator, operand } = payload;

            expect(method).toBe(Method.Math);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(operator).toBe(MathOperator.Addition);
            expect(operand).toBe(1);
          });

          test('GIVEN provider w/o data at path THEN returns payload w/ error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 0 });

            const payload = await provider[Method.Math]({
              method: Method.Math,
              errors: [],
              key: 'key',
              path: ['path'],
              operator: MathOperator.Addition,
              operand: 1
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, operator, operand } = payload;

            expect(method).toBe(Method.Math);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(operator).toBe(MathOperator.Addition);
            expect(operand).toBe(1);
          });

          test('GIVEN provider w/ invalid type at key THEN returns payload w/ error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Math]({
              method: Method.Math,
              errors: [],
              key: 'key',
              path: [],
              operator: MathOperator.Addition,
              operand: 1
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, operator, operand } = payload;

            expect(method).toBe(Method.Math);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(operator).toBe(MathOperator.Addition);
            expect(operand).toBe(1);
          });

          test('GIVEN provider w/ invalid type at path THEN returns payload w/ error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            const payload = await provider[Method.Math]({
              method: Method.Math,
              errors: [],
              key: 'key',
              path: ['path'],
              operator: MathOperator.Addition,
              operand: 1
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, operator, operand } = payload;

            expect(method).toBe(Method.Math);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(operator).toBe(MathOperator.Addition);
            expect(operand).toBe(1);
          });

          for (const operator of Object.values(MathOperator)) {
            test(`GIVEN provider w/ data at key THEN returns payload and applies math (${operator})`, async () => {
              const value = 50;

              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value });

              const operand = 5;
              const payload = await provider[Method.Math]({
                method: Method.Math,
                key: 'key',
                path: [],
                errors: [],
                operator,
                operand
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, key, path, operator: providerOperator } = payload;

              expect(method).toBe(Method.Math);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(key).toBe('key');
              expect(path).toEqual([]);
              expect(providerOperator).toBe(operator);

              const getPayload = await provider[Method.Get]({
                method: Method.Get,
                errors: [],
                key: 'key',
                path: []
              });

              expect(getPayload.data).toBe(doMath(operator, value, operand));
            });
          }
        });

        describe(Method.Partition, () => {
          describe(Payload.Type.Hook.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload w/o data', async () => {
              const payload = await provider[Method.Partition]({
                method: Method.Partition,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, hook, data } = payload;

              expect(method).toBe(Method.Partition);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(type).toBe(Payload.Type.Hook);
              expect(typeof hook).toBe('function');
              expect(data?.truthy).toEqual({});
              expect(data?.falsy).toEqual({});
            });

            test('GIVEN provider w/ data THEN returns payload w/ data', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Partition]({
                method: Method.Partition,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, hook, data } = payload;

              expect(method).toBe(Method.Partition);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(type).toBe(Payload.Type.Hook);
              expect(typeof hook).toBe('function');
              expect(data?.truthy).toEqual({ key: 'value' });
              expect(data?.falsy).toEqual({});
            });

            test('GIVEN provider w/ data THEN returns payload w/ data', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Partition]({
                method: Method.Partition,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value !== 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, hook, data } = payload;

              expect(method).toBe(Method.Partition);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(type).toBe(Payload.Type.Hook);
              expect(typeof hook).toBe('function');
              expect(data?.truthy).toEqual({});
              expect(data?.falsy).toEqual({ key: 'value' });
            });
          });

          describe(Payload.Type.Value.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload w/o data', async () => {
              const payload = await provider[Method.Partition]({
                method: Method.Partition,
                errors: [],
                type: Payload.Type.Value,
                path: [],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, path, value, data } = payload;

              expect(method).toBe(Method.Partition);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(type).toBe(Payload.Type.Value);
              expect(path).toEqual([]);
              expect(value).toBe('value');
              expect(data?.truthy).toEqual({});
              expect(data?.falsy).toEqual({});
            });

            test('GIVEN provider w/ data THEN returns payload w/ data', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Partition]({
                method: Method.Partition,
                errors: [],
                type: Payload.Type.Value,
                path: [],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, path, value, data } = payload;

              expect(method).toBe(Method.Partition);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(type).toBe(Payload.Type.Value);
              expect(path).toEqual([]);
              expect(value).toBe('value');
              expect(data?.truthy).toEqual({ key: 'value' });
              expect(data?.falsy).toEqual({});
            });

            test('GIVEN provider w/ data w/ invalid path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

              const payload = await provider[Method.Partition]({
                method: Method.Partition,
                errors: [],
                type: Payload.Type.Value,
                path: ['invalid'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, path, value, data } = payload;

              expect(method).toBe(Method.Partition);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
              expect(type).toBe(Payload.Type.Value);
              expect(path).toEqual(['invalid']);
              expect(value).toBe('value');
              expect(data?.truthy).toEqual({});
              expect(data?.falsy).toEqual({});
            });

            test('GIVEN provider w/ data w/ invalid primitive at path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: {} });

              const payload = await provider[Method.Partition]({
                method: Method.Partition,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, path, value, data } = payload;

              expect(method).toBe(Method.Partition);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
              expect(type).toBe(Payload.Type.Value);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data?.truthy).toEqual({});
              expect(data?.falsy).toEqual({});
            });

            test('GIVEN provider w/ data THEN returns payload w/ data', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Partition]({
                method: Method.Partition,
                errors: [],
                type: Payload.Type.Value,
                path: [],
                value: 'anotherValue'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, path, value, data } = payload;

              expect(method).toBe(Method.Partition);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(type).toBe(Payload.Type.Value);
              expect(path).toEqual([]);
              expect(value).toBe('anotherValue');
              expect(data?.truthy).toEqual({});
              expect(data?.falsy).toEqual({ key: 'value' });
            });
          });
        });

        describe(Method.Push, () => {
          test('GIVEN provider w/o data THEN returns payload w/ missing data error', async () => {
            const payload = await provider[Method.Push]({ method: Method.Push, errors: [], key: 'key', path: [], value: 'value' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, value } = payload;

            expect(method).toBe(Method.Push);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(value).toBe('value');
          });

          test('GIVEN provider w/o data at path THEN returns payload w/ missing data error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: {} });

            const payload = await provider[Method.Push]({ method: Method.Push, errors: [], key: 'key', path: ['path'], value: 'value' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, value } = payload;

            expect(method).toBe(Method.Push);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(value).toBe('value');
          });

          test('GIVEN provider w/ invalid type at key THEN returns payload w/ invalid type error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Push]({ method: Method.Push, errors: [], key: 'key', path: [], value: 'value' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, value } = payload;

            expect(method).toBe(Method.Push);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(value).toBe('value');
          });

          test('GIVEN provider w/ invalid type at path THEN returns payload w/ invalid type error', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            const payload = await provider[Method.Push]({ method: Method.Push, errors: [], key: 'key', path: ['path'], value: 'value' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, value } = payload;

            expect(method).toBe(Method.Push);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(value).toBe('value');
          });

          test('GIVEN provider w/ array at key THEN returns payload AND pushes value to array at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: [] });

            const payload = await provider[Method.Push]({ method: Method.Push, errors: [], key: 'key', path: [], value: 'value' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, value } = payload;

            expect(method).toBe(Method.Push);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(value).toBe('value');

            const get = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

            expect(get.data).toEqual(['value']);
          });

          test('GIVEN provider w/ array at path THEN returns payload AND pushes value to array at path', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: [] });

            const payload = await provider[Method.Push]({ method: Method.Push, errors: [], key: 'key', path: ['path'], value: 'value' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, value } = payload;

            expect(method).toBe(Method.Push);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(value).toBe('value');

            const get = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: ['path'] });

            expect(get.data).toEqual(['value']);
          });
        });

        describe(Method.Random, () => {
          describe('Values must be unique', () => {
            test('GIVEN provider w/o data THEN returns payload w/o data', async () => {
              const payload = await provider[Method.Random]({ method: Method.Random, errors: [], count: 1, unique: true });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.Random);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual([]);
            });

            test('GIVEN provider w/ 1 doc THEN adds error w/ count > 1', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Random]({ method: Method.Random, errors: [], count: 2, unique: true });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.Random);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidCount);
              expect(data).toBe(undefined);
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from random', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Random]({ method: Method.Random, errors: [], count: 1, unique: true });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.Random);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual(['value']);
            });
          });

          describe("Values don't have to be unique", () => {
            test('GIVEN provider w/o data THEN returns payload w/o data', async () => {
              const payload = await provider[Method.Random]({ method: Method.Random, errors: [], count: 1, unique: false });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.Random);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual([]);
            });

            test('GIVEN provider w/ 1 doc THEN returns payload w/ data from random', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Random]({ method: Method.Random, errors: [], count: 2, unique: false });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.Random);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual(['value', 'value']);
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from random', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Random]({ method: Method.Random, errors: [], count: 1, unique: false });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.Random);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual(['value']);
            });
          });
        });

        describe(Method.RandomKey, () => {
          describe('Values must be unique', () => {
            test('GIVEN provider w/o data THEN returns payload w/o data', async () => {
              const payload = await provider[Method.RandomKey]({ method: Method.RandomKey, errors: [], count: 1, unique: true });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.RandomKey);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual([]);
            });

            test('GIVEN provider w/ 1 doc THEN adds error w/ count > 1', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.RandomKey]({ method: Method.RandomKey, errors: [], count: 2, unique: true });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.RandomKey);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidCount);
              expect(data).toBe(undefined);
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from randomKey', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.RandomKey]({ method: Method.RandomKey, errors: [], count: 1, unique: true });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.RandomKey);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual(['key']);
            });
          });

          describe("Values don't have to be unique", () => {
            test('GIVEN provider w/o data THEN returns payload w/o data', async () => {
              const payload = await provider[Method.RandomKey]({ method: Method.RandomKey, errors: [], count: 1, unique: false });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.RandomKey);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual([]);
            });

            test('GIVEN provider w/ 1 doc THEN returns payload w/ data from randomKey', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.RandomKey]({ method: Method.RandomKey, errors: [], count: 2, unique: false });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.RandomKey);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual(['key', 'key']);
            });

            test('GIVEN provider w/ data THEN returns payload w/ data from randomKey', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.RandomKey]({ method: Method.RandomKey, errors: [], count: 1, unique: false });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, data } = payload;

              expect(method).toBe(Method.RandomKey);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(data).toEqual(['key']);
            });
          });
        });

        describe(Method.Remove, () => {
          describe(Payload.Type.Hook.toString(), () => {
            test('GIVEN provider w/o data at key THEN returns payload w/ missing data error', async () => {
              const payload = await provider[Method.Remove]({
                method: Method.Remove,
                errors: [],
                type: Payload.Type.Hook,
                key: 'key',
                path: [],
                hook: (value: string) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, key, path, hook } = payload;

              expect(method).toBe(Method.Remove);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
              expect(type).toBe(Payload.Type.Hook);
              expect(key).toBe('key');
              expect(path).toEqual([]);
              expect(typeof hook).toBe('function');
            });

            test('GIVEN provider w/ invalid type at key THEN returns payload w/ invalid type error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Remove]({
                method: Method.Remove,
                errors: [],
                type: Payload.Type.Hook,
                key: 'key',
                path: [],
                hook: (value: string) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, key, path, hook } = payload;

              expect(method).toBe(Method.Remove);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
              expect(type).toBe(Payload.Type.Hook);
              expect(key).toBe('key');
              expect(path).toEqual([]);
              expect(typeof hook).toBe('function');
            });

            test('GIVEN provider w/ array at key THEN returns payload AND removes value from array at key', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: ['value'] });

              const getBefore = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

              expect(getBefore.data).toEqual(['value']);

              const payload = await provider[Method.Remove]({
                method: Method.Remove,
                errors: [],
                type: Payload.Type.Hook,
                key: 'key',
                path: [],
                hook: (value: string) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, key, path, hook } = payload;

              expect(method).toBe(Method.Remove);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(type).toBe(Payload.Type.Hook);
              expect(key).toBe('key');
              expect(path).toEqual([]);
              expect(typeof hook).toBe('function');

              const getAfter = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

              expect(getAfter.data).toEqual([]);
            });
          });

          describe(Payload.Type.Value.toString(), () => {
            test('GIVEN provider w/o data at key THEN returns payload w/ missing data error', async () => {
              const payload = await provider[Method.Remove]({
                method: Method.Remove,
                errors: [],
                type: Payload.Type.Value,
                key: 'key',
                path: [],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, key, path, value } = payload;

              expect(method).toBe(Method.Remove);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
              expect(type).toBe(Payload.Type.Value);
              expect(key).toBe('key');
              expect(path).toEqual([]);
              expect(value).toBe('value');
            });

            test('GIVEN provider w/ invalid type at key THEN returns payload w/ invalid type error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Remove]({
                method: Method.Remove,
                errors: [],
                type: Payload.Type.Value,
                key: 'key',
                path: [],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, key, path, value } = payload;

              expect(method).toBe(Method.Remove);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
              expect(type).toBe(Payload.Type.Value);
              expect(key).toBe('key');
              expect(path).toEqual([]);
              expect(value).toBe('value');
            });

            test('GIVEN provider w/ array at key THEN returns payload AND removes value from array at key', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: ['value'] });

              const getBefore = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

              expect(getBefore.data).toEqual(['value']);

              const payload = await provider[Method.Remove]({
                method: Method.Remove,
                errors: [],
                type: Payload.Type.Value,
                key: 'key',
                path: [],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, type, key, path, value } = payload;

              expect(method).toBe(Method.Remove);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(type).toBe(Payload.Type.Value);
              expect(key).toBe('key');
              expect(path).toEqual([]);
              expect(value).toBe('value');

              const getAfter = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

              expect(getAfter.data).toEqual([]);
            });
          });
        });

        describe(Method.Set, () => {
          test('GIVEN provider w/o data THEN returns payload AND sets value at key', async () => {
            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasBefore.data).toBe(false);

            const payload = await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, value } = payload;

            expect(method).toBe(Method.Set);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual([]);
            expect(value).toBe('value');

            const hasAfter = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasAfter.data).toBe(true);
          });

          test('GIVEN provider w/o data THEN returns payload AND sets value at key and path', async () => {
            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: ['path'] });

            expect(hasBefore.data).toBe(false);

            const payload = await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, path, value } = payload;

            expect(method).toBe(Method.Set);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(path).toEqual(['path']);
            expect(value).toBe('value');

            const hasAfter = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: ['path'] });

            expect(hasAfter.data).toBe(true);
          });
        });

        describe(Method.SetMany, () => {
          test('GIVEN provider w/o data THEN returns payload AND sets value at key', async () => {
            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasBefore.data).toBe(false);

            const payload = await provider[Method.SetMany]({
              method: Method.SetMany,
              errors: [],
              entries: [{ key: 'key', path: [], value: 'value' }],
              overwrite: true
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, entries } = payload;

            expect(method).toBe(Method.SetMany);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(entries).toEqual([{ key: 'key', path: [], value: 'value' }]);
          });

          test('GIVEN provider w/ data THEN returns payload AND does not set value at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasBefore.data).toBe(true);

            const payload = await provider[Method.SetMany]({
              method: Method.SetMany,
              errors: [],
              entries: [{ key: 'key', path: [], value: 'anotherValue' }],
              overwrite: false
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, entries } = payload;

            expect(method).toBe(Method.SetMany);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(entries).toEqual([{ key: 'key', path: [], value: 'anotherValue' }]);

            const getAfter = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

            expect(getAfter.data).toBe('value');
          });

          test('GIVEN provider w/ data THEN returns payload AND does overwrite value at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const hasBefore = await provider[Method.Has]({ method: Method.Has, errors: [], key: 'key', path: [] });

            expect(hasBefore.data).toBe(true);

            const payload = await provider[Method.SetMany]({
              method: Method.SetMany,
              errors: [],
              entries: [{ key: 'key', path: [], value: 'anotherValue' }],
              overwrite: true
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, entries } = payload;

            expect(method).toBe(Method.SetMany);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(entries).toEqual([{ key: 'key', path: [], value: 'anotherValue' }]);

            const getAfter = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

            expect(getAfter.data).toBe('anotherValue');
          });
        });

        describe(Method.Size, () => {
          test('GIVEN provider w/o data THEN returns payload(0)', async () => {
            const payload = await provider[Method.Size]({ method: Method.Size, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.Size);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(data).toBe(0);
          });

          test('GIVEN provider w/ data THEN returns payload(1)', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Size]({ method: Method.Size, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.Size);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(data).toBe(1);
          });
        });

        describe(Method.Some, () => {
          describe(Payload.Type.Hook.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload(false)', async () => {
              const payload = await provider[Method.Some]({
                method: Method.Some,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Some);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toBe(false);
            });

            test('GIVEN provider w/ data THEN returns payload(true)', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Some]({
                method: Method.Some,
                errors: [],
                type: Payload.Type.Hook,
                hook: (value) => value === 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, hook, data } = payload;

              expect(method).toBe(Method.Some);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(typeof hook).toBe('function');
              expect(data).toBe(true);
            });
          });

          describe(Payload.Type.Value.toString(), () => {
            test('GIVEN provider w/o data THEN returns payload(false)', async () => {
              const payload = await provider[Method.Some]({
                method: Method.Some,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Some);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toBe(false);
            });

            test('GIVEN provider w/ data THEN returns payload(true)', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

              const payload = await provider[Method.Some]({
                method: Method.Some,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Some);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toBe(true);
            });

            test('GIVEN provider w/ data w/ invalid path THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

              const payload = await provider[Method.Some]({
                method: Method.Some,
                errors: [],
                type: Payload.Type.Value,
                path: ['invalid'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Some);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
              expect(path).toEqual(['invalid']);
              expect(value).toBe('value');
              expect(data).toBe(false);
            });

            test('GIVEN provider w/ data w/ invalid primitive THEN adds error', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: {} });

              const payload = await provider[Method.Some]({
                method: Method.Some,
                errors: [],
                type: Payload.Type.Value,
                path: ['path'],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Some);
              expect(trigger).toBeUndefined();
              expect(errors.length).toBe(1);
              expect(errors[0].identifier).toBe(CommonIdentifiers.InvalidDataType);
              expect(path).toEqual(['path']);
              expect(value).toBe('value');
              expect(data).toBe(false);
            });

            test('GIVEN provider w/o data w/o path THEN returns payload(false)', async () => {
              const payload = await provider[Method.Some]({
                method: Method.Some,
                errors: [],
                type: Payload.Type.Value,
                path: [],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Some);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual([]);
              expect(value).toBe('value');
              expect(data).toBe(false);
            });

            test('GIVEN provider w/ data w/o path THEN returns payload(true)', async () => {
              await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

              const payload = await provider[Method.Some]({
                method: Method.Some,
                errors: [],
                type: Payload.Type.Value,
                path: [],
                value: 'value'
              });

              expect(typeof payload).toBe('object');

              const { method, trigger, errors, path, value, data } = payload;

              expect(method).toBe(Method.Some);
              expect(trigger).toBeUndefined();
              expect(errors).toStrictEqual([]);
              expect(path).toEqual([]);
              expect(value).toBe('value');
              expect(data).toBe(true);
            });
          });
        });

        describe(Method.Update, () => {
          test('GIVEN provider w/o data THEN returns payload w/ missing data error', async () => {
            const payload = await provider[Method.Update]({ method: Method.Update, errors: [], key: 'key', hook: (value) => value });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, hook } = payload;

            expect(method).toBe(Method.Update);
            expect(trigger).toBeUndefined();
            expect(errors.length).toBe(1);
            expect(errors[0].identifier).toBe(CommonIdentifiers.MissingData);
            expect(key).toBe('key');
            expect(typeof hook).toBe('function');
          });

          test('GIVEN provider w/ data at key THEN returns payload w/ data AND updates value at key', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Update]({
              method: Method.Update,
              errors: [],
              key: 'key',
              hook: (value) => (value as string).toUpperCase()
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, hook } = payload;

            expect(method).toBe(Method.Update);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(typeof hook).toBe('function');

            const get = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

            expect(get.data).toEqual('VALUE');
          });

          test('GIVEN provider w/ data at path THEN returns payload w/ data AND updates value at path', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: ['path'], value: 'value' });

            const payload = await provider[Method.Update]({
              method: Method.Update,
              errors: [],
              key: 'key',
              hook: (value) => ({ path: (value as Record<'path', string>).path.toUpperCase() })
            });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, key, hook } = payload;

            expect(method).toBe(Method.Update);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(key).toBe('key');
            expect(typeof hook).toBe('function');

            const get = await provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: ['path'] });

            expect(get.data).toEqual('VALUE');
          });
        });

        describe(Method.Values, () => {
          test('GIVEN provider w/o data THEN returns payload w/o data', async () => {
            const payload = await provider[Method.Values]({ method: Method.Values, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.Values);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(data).toEqual([]);
          });

          test('GIVEN provider w/ data THEN returns payload w/ data', async () => {
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 'value' });

            const payload = await provider[Method.Values]({ method: Method.Values, errors: [] });

            expect(typeof payload).toBe('object');

            const { method, trigger, errors, data } = payload;

            expect(method).toBe(Method.Values);
            expect(trigger).toBeUndefined();
            expect(errors).toStrictEqual([]);
            expect(data).toEqual(['value']);
          });
        });

        describe(Method.Each, () => {
          test('GIVEN provider w/o data THEN loops 0 times', () => {
            const mockCallback = vi.fn(() => true);
            const payload = provider[Method.Each]({ method: Method.Each, errors: [], hook: () => mockCallback() });

            expect(typeof payload).toBe('object');
            expect(mockCallback.mock.calls.length).toBe(0);
          });

          test('GIVEN provider w/ data THEN loops x times THEN clears', async () => {
            const mockCallback = vi.fn((..._) => true);

            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'firstKey', path: [], value: 'firstValue' });
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'secondKey', path: [], value: 'secondValue' });
            await provider[Method.Set]({ method: Method.Set, errors: [], key: 'thirdKey', path: [], value: 'thirdValue' });

            const payload = await provider[Method.Each]({ method: Method.Each, errors: [], hook: mockCallback });

            expect(typeof payload).toBe('object');
            expect(mockCallback.mock.calls.length).toBe(3);
            expect(mockCallback.mock.calls).toContainEqual(['firstValue', 'firstKey']);
            expect(mockCallback.mock.calls).toContainEqual(['secondValue', 'secondKey']);
            expect(mockCallback.mock.calls).toContainEqual(['thirdValue', 'thirdKey']);
          });
        });

        describe('metadata', () => {
          beforeAll(async () => {
            await provider.deleteMetadata('key');
          });

          test('GIVEN provider w/o metadata THEN sets metadata', async () => {
            await provider.setMetadata('key', 'value');
          });

          test('GIVEN provider w/ metadata THEN gets metadata', async () => {
            await provider.setMetadata('key', 'value');

            const metadata = await provider.getMetadata('key');

            expect(metadata).toBe('value');
          });

          test('GIVEN provider w/ metadata THEN overwrites metadata', async () => {
            await provider.setMetadata('key', 'value');

            const metadata = await provider.setMetadata('key', 'value1');

            expect(metadata).toBe(undefined);
            expect(await provider.getMetadata('key')).toBe('value1');
          });

          test('GIVEN provider w/ metadata THEN delete metadata', async () => {
            await provider.setMetadata('key', 'value');

            expect(await provider.getMetadata('key')).toBe('value');

            await provider.deleteMetadata('key');

            expect(await provider.getMetadata('key')).toBe(undefined);
          });
        });
      });
    });
  }
}

export interface ProviderTestOptions<
  Provider extends Constructor<JoshProvider>,
  Options extends JoshProvider.Options = JoshProvider.Options,
  CleanupProvider extends JoshProvider = JoshProvider
> {
  providerConstructor: Provider;

  providerOptions?: Options;

  serialization?: boolean;

  cleanup?: (provider: CleanupProvider) => Awaitable<void>;
}
