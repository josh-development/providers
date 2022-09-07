import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
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
      maxChunkSize: 1,
      dataDirectory: '.tests',
      serialize: false
    });

    beforeAll(async () => {
      await rm(resolve(process.cwd(), '.tests', 'chunkHandler'), { recursive: true, force: true });

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

    describe('with delete method', () => {
      test('GIVEN no chunks THEN returns false', async () => {
        await expect(handler.delete('test:delete')).resolves.toBe(false);
      });

      test('GIVEN chunks THEN returns true AND deletes value', async () => {
        await handler.set('test:delete', 'value');
        await expect(handler.delete('test:delete')).resolves.toBe(true);
      });
    });

    describe('with deleteMany method', () => {
      test('GIVEN no chunks THEN does nothing', async () => {
        await expect(handler.deleteMany(['test:deleteMany'])).resolves.toBeUndefined();
      });

      test('GIVEN chunk THEN deletes value', async () => {
        await handler.set('test:deleteMany', 'value');

        await expect(handler.deleteMany(['test:deleteMany'])).resolves.toBeUndefined();

        await expect(handler.has('test:deleteMany')).resolves.toBe(false);
      });

      test('GIVEN chunks THEN deletes values', async () => {
        await handler.set('test:deleteMany', 'value');
        await handler.set('test:deleteMany2', 'value');

        await expect(handler.deleteMany(['test:deleteMany', 'test:deleteMany2'])).resolves.toBeUndefined();

        await expect(handler.has('test:deleteMany')).resolves.toBe(false);
        await expect(handler.has('test:deleteMany2')).resolves.toBe(false);
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

    describe('with get method', () => {
      test('GIVEN no chunks THEN returns undefined', async () => {
        await expect(handler.get('test:get')).resolves.toBeUndefined();
      });

      test('GIVEN chunks THEN returns value', async () => {
        await handler.set('test:get', 'value');
        await expect(handler.get('test:get')).resolves.toBe('value');
      });
    });

    describe('with getMany method', () => {
      test('GIVEN no chunks THEN returns empty array', async () => {
        await expect(handler.getMany(['test:getMany'])).resolves.toEqual({ 'test:getMany': null });
      });

      test('GIVEN chunk THEN returns value', async () => {
        await handler.set('test:getMany', 'value');
        await expect(handler.getMany(['test:getMany'])).resolves.toEqual({ 'test:getMany': 'value' });
      });

      test('GIVEN chunks THEN returns values', async () => {
        await handler.set('test:getMany', 'value');
        await handler.set('test:getMany2', 'value');
        await expect(handler.getMany(['test:getMany', 'test:getMany2'])).resolves.toEqual({ 'test:getMany': 'value', 'test:getMany2': 'value' });
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

    describe('with keys method', () => {
      test('with no chunks THEN returns empty array', async () => {
        await expect(handler.keys()).resolves.toEqual([]);
      });

      test('with chunks THEN returns array', async () => {
        await handler.set('test:keys', 'value');
        await expect(handler.keys()).resolves.toEqual(['test:keys']);
      });
    });

    describe('with set method', () => {
      test('GIVEN no chunks THEN sets value', async () => {
        await expect(handler.set('test:set', 'value')).resolves.toBeUndefined();
        await expect(handler.has('test:set')).resolves.toBe(true);
      });
    });

    describe('with setMany method', () => {
      test('GIVEN no chunks THEN sets values', async () => {
        await expect(handler.setMany([['test:setMany', 'value']], true)).resolves.toBeUndefined();

        await expect(handler.has('test:setMany')).resolves.toBe(true);
      });

      test('GIVEN chunk THEN sets value', async () => {
        await handler.set('test:setMany', 'value');
        await expect(handler.setMany([['test:setMany', 'value']], true)).resolves.toBeUndefined();

        await expect(handler.has('test:setMany')).resolves.toBe(true);
      });

      test('GIVEN chunk THEN skips value', async () => {
        await handler.set('test:setMany', 'value');
        await expect(handler.setMany([['test:setMany', 'value2']], false)).resolves.toBeUndefined();

        await expect(handler.get('test:setMany')).resolves.toBe('value');
      });

      test('GIVEN chunks THEN sets values', async () => {
        await expect(
          handler.setMany(
            [
              ['test:setMany', 'value'],
              ['test:setMany2', 'value']
            ],
            true
          )
        ).resolves.toBeUndefined();

        await expect(handler.has('test:setMany')).resolves.toBe(true);
        await expect(handler.has('test:setMany2')).resolves.toBe(true);
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
  });
});
