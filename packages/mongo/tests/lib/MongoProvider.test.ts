import { MongoProvider } from '../../src';
import { Method, Payload } from '@joshdb/core';

describe('MongoProvider', () => {
	describe('is a class', () => {
		test('GIVEN typeof MongoProvider THEN returns function', () => {
			expect(typeof MongoProvider).toBe('function');
		});

		test('GIVEN typeof ...prototype THEN returns object', () => {
			expect(typeof MongoProvider.prototype).toBe('object');
		});
	});

	describe('can manipulate provider data', () => {
		const provider = new MongoProvider({ collection: 'josh-test' });

		beforeAll((cb) => {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			provider.init({ name: 'joshtest' }).then(() => {
				console.log('Connected');
				cb();
			});
		});

		beforeEach(async () => {
			await provider.clear({ method: Method.Clear });
		});

		afterAll(async () => {
			await provider.close();
		});

		describe('with autoKey method', () => {
			test('GIVEN ... THEN returns payload', async () => {
				const payload = await provider.autoKey({ method: Method.AutoKey, data: '0' });

				expect(typeof payload).toBe('object');
			});
		});

		describe('with clear method', () => {
			test('GIVEN ... THEN returns payload', async () => {
				const payload = await provider.clear({ method: Method.Clear });

				expect(typeof payload).toBe('object');
			});
		});

		describe('with dec method', () => {
			test('GIVEN ... THEN returns payload', async () => {
				const payload = await provider.dec({ method: Method.Dec, key: 'test:dec', path: [] });

				expect(typeof payload).toBe('object');
			});
		});

		describe('with delete method', () => {
			test('GIVEN ... THEN returns payload', async () => {
				const payload = await provider.delete({ method: Method.Delete, key: 'test:delete', path: [] });

				expect(typeof payload).toBe('object');
			});
		});

		describe('with ensure method', () => {
			test('GIVEN ... THEN returns payload', async () => {
				const payload = await provider.ensure({ method: Method.Ensure, key: 'test:ensure', defaultValue: 'defaultValue', data: 'defaultValue' });

				expect(typeof payload).toBe('object');
			});
		});

		describe('with every method', () => {
			describe('hook type', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.every({ method: Method.Every, type: Payload.Type.Hook, hook: (value) => value === 'value', data: true });

					expect(typeof payload).toBe('object');
				});

				test('with value type', async () => {
					const payload = await provider.every({ method: Method.Every, type: Payload.Type.Value, path: ['path'], value: 'value', data: true });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with filter method', () => {
				describe('hook type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.filter({ method: Method.Filter, type: Payload.Type.Hook, hook: (value) => value === 'value', data: {} });

						expect(typeof payload).toBe('object');
					});
				});

				describe('value type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.filter({ method: Method.Filter, type: Payload.Type.Value, path: ['path'], value: 'value', data: {} });

						expect(typeof payload).toBe('object');
					});
				});
			});

			describe('with find method', () => {
				describe('hook type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.find({ method: Method.Find, type: Payload.Type.Hook, hook: (value) => value === 'value' });

						expect(typeof payload).toBe('object');
					});
				});

				describe('value type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.find({ method: Method.Find, type: Payload.Type.Value, path: ['path'], value: 'value' });

						expect(typeof payload).toBe('object');
					});
				});
			});

			describe('with get method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.get({ method: Method.Get, key: 'test:get', path: [] });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with getAll method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.getAll({ method: Method.GetAll, data: {} });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with getMany method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.getMany({ method: Method.GetMany, keys: ['test:getMany'], data: {} });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with has method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.has({ method: Method.Has, key: 'test:has', path: [], data: false });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with inc method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.inc({ method: Method.Inc, key: 'test:inc', path: [] });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with keys method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.keys({ method: Method.Keys, data: [] });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with map method', () => {
				describe('hook type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.map({ method: Method.Map, type: Payload.Type.Hook, hook: (value) => value, data: [] });

						expect(typeof payload).toBe('object');
					});
				});

				describe('path type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.map({ method: Method.Map, type: Payload.Type.Path, path: [], data: [] });

						expect(typeof payload).toBe('object');
					});
				});
			});

			describe('with partition method', () => {
				describe('hook type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.partition({
							method: Method.Partition,
							type: Payload.Type.Hook,
							hook: (value) => value === 'value',
							data: { truthy: {}, falsy: {} }
						});

						expect(typeof payload).toBe('object');
					});
				});

				describe('value type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.partition({
							method: Method.Partition,
							type: Payload.Type.Value,
							path: [],
							value: 'value',
							data: { truthy: {}, falsy: {} }
						});

						expect(typeof payload).toBe('object');
					});
				});
			});

			describe('with push method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.push({ method: Method.Push, key: 'test:push', path: [], value: 'value' });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with random method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.random({ method: Method.Random });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with randomKey', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.randomKey({ method: Method.RandomKey });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with remove method', () => {
				describe('hook type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.remove({
							method: Method.Remove,
							type: Payload.Type.Hook,
							key: 'test:remove',
							path: [],
							hook: (value) => value === 'value'
						});

						expect(typeof payload).toBe('object');
					});
				});

				describe('value type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.remove({ method: Method.Remove, type: Payload.Type.Value, key: 'test:remove', path: [], value: 'value' });

						expect(typeof payload).toBe('object');
					});
				});
			});

			describe('with set method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.set({ method: Method.Set, key: 'test:set', path: [], value: 'value' });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with setMany method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.setMany({ method: Method.SetMany, keys: ['test:setMany'], value: 'value' });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with size method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.size({ method: Method.Size, data: 0 });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with some method', () => {
				describe('hook type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.some({ method: Method.Some, type: Payload.Type.Hook, hook: (value) => value === 'value', data: false });

						expect(typeof payload).toBe('object');
					});
				});

				describe('value type', () => {
					test('GIVEN ... THEN returns payload', async () => {
						const payload = await provider.some({ method: Method.Some, type: Payload.Type.Value, path: ['path'], value: 'value', data: false });

						expect(typeof payload).toBe('object');
					});
				});
			});

			describe('with update method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.update({ method: Method.Update, key: 'test:update', path: [], hook: (value) => value });

					expect(typeof payload).toBe('object');
				});
			});

			describe('with values method', () => {
				test('GIVEN ... THEN returns payload', async () => {
					const payload = await provider.values({ method: Method.Values, data: [] });

					expect(typeof payload).toBe('object');
				});
			});
		});
	});
});
