import 'fake-indexeddb/auto';
import DbHandler from '../../src/lib/DbHandler';

describe('DbHandler', () => {
  describe('is a class', () => {
    test(`GIVEN typeof DbHandler THEN returns function`, () => {
      expect(typeof DbHandler).toBe('function');
    });

    test('GIVEN typeof ...prototype THEN returns object', () => {
      expect(typeof DbHandler.prototype).toBe('object');
    });
  });

  describe('Can manipulate data.', () => {
    const handler = new DbHandler();

    beforeAll(async () => {
      await handler.init();
    });

    beforeEach(async () => {
      await handler.clear();
    });

    test('Can set and subsequently get data', async () => {
      await handler.set('string', 'hello world');
      await handler.set('num', 420);
      await handler.set('obj', { hello: 'world' });
      await handler.set('array', [1, 2, 3]);
      expect(await handler.get('string')).toEqual('hello world');
      expect(await handler.get('num')).toEqual(420);
      expect(await handler.get('obj')).toEqual({ hello: 'world' });
      expect(await handler.get('array')).toEqual([1, 2, 3]);
    });

    test('Can get all data', async () => {
      expect(await handler.getAll()).toEqual({});
      await handler.set('string', 'hello world');
      await handler.set('num', 420);
      await handler.set('obj', { hello: 'world' });
      await handler.set('array', [1, 2, 3]);
      expect(await handler.getAll()).toEqual({ num: 420, obj: { hello: 'world' }, string: 'hello world', array: [1, 2, 3] });
    });

    test('Can get all keys', async () => {
      expect(await handler.getKeys()).toEqual([]);
      await handler.set('string', 'hello world');
      await handler.set('num', 420);
      await handler.set('obj', { hello: 'world' });
      await handler.set('array', [1, 2, 3]);
      expect(await handler.getKeys()).toEqual(['array', 'num', 'obj', 'string']);
    });

    test('Can delete data', async () => {
      await handler.set('string', 'hello world');
      await handler.delete('string');
      expect(await handler.get('string')).toBeUndefined();
    });

    test('Can has data', async () => {
      expect(await handler.has('string')).toEqual(false);
      await handler.set('string', 'hello world');
      expect(await handler.has('string')).toEqual(true);
    });

    test('Can count data', async () => {
      expect(await handler.count()).toEqual(0);
      await handler.set('string', 'hello world');
      await handler.set('string2', 'hello world');
      await handler.set('string3', 'hello world');
      expect(await handler.count()).toEqual(3);
    });

    test('Can clear data', async () => {
      await handler.set('string', 'hello world');
      await handler.set('string2', 'hello world');
      await handler.set('string3', 'hello world');
      await handler.clear();
      expect(await handler.count()).toEqual(0);
    });
  });
});
