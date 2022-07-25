import { ChunkHandler } from '../../src';

describe('ChunkHandler', () => {
  describe('is a class', () => {
    test('GIVEN typeof ChunkHandler THEN returns function', () => {
      expect(typeof ChunkHandler).toBe('function');
    });

    test('GIVEN typeof ...prototype THEN returns object', () => {
      expect(typeof ChunkHandler.prototype).toBe('object');
    });
  });

  describe('can manipulate chunk data', () => {
    const handler = new ChunkHandler({
      name: 'chunkHandler',
      version: { major: 0, minor: 0, patch: 0 },
      maxChunkSize: 100,
      dataDirectory: '.tests',
      serialize: false
    });

    beforeAll(async () => {
      await handler.init();
    });

    beforeEach(async () => {
      await handler.clear();
    });

    describe('with synchronize method', () => {
      test('GIVEN no chunks THEN synchronizes', async () => {
        await expect(handler.synchronize()).resolves.toBeUndefined();
      });
    });

    describe('with has method', () => {
      test('GIVEN no chunks THEN returns false', async () => {
        await expect(handler.has('test:has')).resolves.toBe(false);
      });

      test('GIVEN chunks THEN returns true', async () => {
        await handler.set('test:has', 'value');
        await expect(handler.has('test:has')).resolves.toBe(true);
      });
    });

    describe('with get method', () => {
      test('GIVEN no chunks THEN returns undefined', async () => {
        await expect(handler.get('test:get')).resolves.toBeUndefined();
      });

      test('GIVEN chunks THEN returns value', async () => {
        await handler.set('test:get', 'value');
        await expect(handler.get('test:get')).resolves.toBe('value');
      });
    });

    describe('with set method', () => {
      test('GIVEN no chunks THEN sets value', async () => {
        await expect(handler.set('test:set', 'value')).resolves.toBeUndefined();
        await expect(handler.has('test:set')).resolves.toBe(true);
      });
    });

    describe('with delete method', () => {
      test('GIVEN no chunks THEN returns false', async () => {
        await expect(handler.delete('test:delete')).resolves.toBe(false);
      });

      test('GIVEN chunks THEN returns true AND deletes value', async () => {
        await handler.set('test:delete', 'value');
        await expect(handler.delete('test:delete')).resolves.toBe(true);
      });
    });

    describe('with clear method', () => {
      test('GIVEN no chunks THEN resolves', async () => {
        await expect(handler.clear()).resolves.toBeUndefined();
        await expect(handler.size()).resolves.toBe(0);
      });

      test('GIVEN chunks THEN clears chunks', async () => {
        await handler.set('test:clear', 'value');
        await expect(handler.size()).resolves.toBe(1);
        await expect(handler.clear()).resolves.toBeUndefined();
        await expect(handler.size()).resolves.toBe(0);
      });
    });

    describe('with size method', () => {
      test('GIVEN no chunks THEN returns 0', async () => {
        await expect(handler.size()).resolves.toBe(0);
      });

      test('GIVEN chunks THEN returns 1', async () => {
        await handler.set('test:size', 'value');
        await expect(handler.size()).resolves.toBe(1);
      });
    });

    describe('with values method', () => {
      test('GIVEN no chunks THEN returns empty array', async () => {
        await expect(handler.values()).resolves.toEqual([]);
      });

      test('GIVEN chunks THEN returns array', async () => {
        await handler.set('test:values', 'value');
        await expect(handler.values()).resolves.toEqual(['value']);
      });
    });

    describe('with entries method', () => {
      test('GIVEN no chunks THEN returns empty array', async () => {
        await expect(handler.entries()).resolves.toEqual([]);
      });

      test('GIVEN chunks THEN returns array', async () => {
        await handler.set('test:entries', 'value');
        await expect(handler.entries()).resolves.toEqual([['test:entries', 'value']]);
      });
    });

    describe('with keys method', () => {
      test('with no chunks THEN returns empty array', async () => {
        await expect(handler.keys()).resolves.toEqual([]);
      });

      test('with chunks THEN returns array', async () => {
        await handler.set('test:keys', 'value');
        await expect(handler.keys()).resolves.toEqual(['test:keys']);
      });
    });
  });
});
