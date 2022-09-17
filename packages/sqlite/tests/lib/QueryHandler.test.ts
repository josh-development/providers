import Database from 'better-sqlite3';
import { QueryHandler } from '../../src';

describe('QueryHandler', () => {
  describe('is a class', () => {
    test('GIVEN typeof QueryHandler THEN returns function', () => {
      expect(typeof QueryHandler).toBe('function');
    });

    test('GIVEN typeof ...prototype THEN returns object', () => {
      expect(typeof QueryHandler.prototype).toBe('object');
    });
  });

  describe('can manipulate query data', () => {
    const handler = new QueryHandler({
      database: new Database(':memory:'),
      tableName: 'queryHandler',
      wal: false,
      version: '1.0.0',
      disableSerialization: true
    });

    beforeEach(() => {
      handler.clear();
    });

    afterAll(() => {
      handler.database.close();
    });

    describe('with autoKey method', () => {
      test('GIVEN empty table THEN increments 3 times', () => {
        expect(handler.autoKey()).toBe('1');
        expect(handler.autoKey()).toBe('2');
        expect(handler.autoKey()).toBe('3');
      });
    });

    describe('with clear method', () => {
      test('GIVEN single row THEN clears', () => {
        handler.set('key', 'value');

        expect(handler.has('key')).toBe(true);
        handler.clear();

        expect(handler.has('key')).toBe(false);
      });

      test('GIVEN multiple rows THEN clears', () => {
        handler.set('key1', 'value1');
        handler.set('key2', 'value2');

        expect(handler.has('key1')).toBe(true);
        expect(handler.has('key2')).toBe(true);
        handler.clear();

        expect(handler.has('key1')).toBe(false);
        expect(handler.has('key2')).toBe(false);
      });
    });

    describe('with delete method', () => {
      test('GIVEN empty table THEN does nothing', () => {
        expect(handler.delete('key')).toBeUndefined();
      });

      test('GIVEN single row THEN deletes data', () => {
        handler.set('key', 'value');

        expect(handler.delete('key')).toBeUndefined();
        expect(handler.has('key')).toBe(false);
      });
    });

    describe('with deleteMany method', () => {
      test('GIVEN empty table THEN does nothing', () => {
        expect(handler.deleteMany(['key'])).toBeUndefined();
      });

      test('GIVEN single row THEN deletes data', () => {
        handler.set('key', 'value');

        expect(handler.deleteMany(['key'])).toBeUndefined();
        expect(handler.has('key')).toBe(false);
      });

      test('GIVEN multiple rows THEN deletes data', () => {
        handler.set('key', 'value');
        handler.set('key2', 'value');

        expect(handler.deleteMany(['key', 'key2'])).toBeUndefined();
        expect(handler.has('key')).toBe(false);
        expect(handler.has('key2')).toBe(false);
      });
    });

    describe('with entries method', () => {
      test('GIVEN empty table THEN returns empty array', () => {
        expect(handler.entries()).toEqual([]);
      });

      test('GIVEN single row THEN returns array', () => {
        handler.set('key', 'value');

        expect(handler.entries()).toEqual([['key', 'value']]);
      });

      test('GIVEN multiple rows THEN returns array', () => {
        handler.set('key', 'value');
        handler.set('key2', 'value');

        expect(handler.entries()).toEqual([
          ['key', 'value'],
          ['key2', 'value']
        ]);
      });
    });

    describe('with has method', () => {
      test('GIVEN empty row THEN returns false', () => {
        expect(handler.has('key')).toBe(false);
      });

      test('GIVEN single row THEN returns true', () => {
        handler.set('key', 'value');

        expect(handler.has('key')).toBe(true);
      });
    });

    describe('with keys method', () => {
      test('GIVEN empty table THEN returns empty array', () => {
        expect(handler.keys()).toEqual([]);
      });

      test('GIVEN single row THEN returns array', () => {
        handler.set('key', 'value');

        expect(handler.keys()).toEqual(['key']);
      });

      test('GIVEN multiple rows THEN returns array', () => {
        handler.set('key', 'value');
        handler.set('key2', 'value');

        expect(handler.keys()).toEqual(['key', 'key2']);
      });
    });

    describe('with get method', () => {
      test('GIVEN empty table THEN returns undefined', () => {
        expect(handler.get('key')).toBeUndefined();
      });

      test('GIVEN single row THEN returns value', () => {
        handler.set('key', 'value');

        expect(handler.get('key')).toBe('value');
      });
    });

    describe('with getMany method', () => {
      test('GIVEN empty table THEN returns empty array', () => {
        expect(handler.getMany(['key'])).toEqual({});
      });

      test('GIVEN single row THEN returns array', () => {
        handler.set('key', 'value');

        expect(handler.getMany(['key'])).toEqual({ key: 'value' });
      });

      test('GIVEN multiple rows THEN returns array', () => {
        handler.set('key', 'value');
        handler.set('key2', 'value');

        expect(handler.getMany(['key', 'key2'])).toEqual({ key: 'value', key2: 'value' });
      });
    });

    describe('with set method', () => {
      test('GIVEN empty table THEN sets data', () => {
        handler.set('key', 'value');

        expect(handler.get('key')).toBe('value');
      });

      test('GIVEN single row THEN updates data', () => {
        handler.set('key', 'value');

        expect(handler.get('key')).toBe('value');

        handler.set('key', 'value2');

        expect(handler.get('key')).toBe('value2');
      });
    });

    describe('with setMany method', () => {
      describe('overwrite enabled', () => {
        test('GIVEN empty table THEN inserts rows', () => {
          expect(handler.has('key')).toBe(false);

          handler.setMany([['key', 'value']], true);

          expect(handler.get('key')).toBe('value');
        });

        test('GIVEN single row THEN updates row', () => {
          handler.set('key', 'value');

          expect(handler.get('key')).toBe('value');

          handler.setMany([['key', 'value2']], true);

          expect(handler.get('key')).toBe('value2');
        });

        test('GIVEN multiple rows THEN updates rows', () => {
          handler.set('key', 'value');
          handler.set('key2', 'value');

          expect(handler.get('key')).toBe('value');
          expect(handler.get('key2')).toBe('value');

          handler.setMany(
            [
              ['key', 'value2'],
              ['key2', 'value2']
            ],
            true
          );

          expect(handler.get('key')).toBe('value2');
          expect(handler.get('key2')).toBe('value2');
        });
      });

      describe('overwrite disabled', () => {
        test('GIVEN single row THEN skips row', () => {
          handler.set('key', 'value');

          expect(handler.get('key')).toBe('value');

          handler.setMany([['key', 'value2']], false);

          expect(handler.get('key')).toBe('value');
        });

        test('GIVEN multiple rows THEN skips rows', () => {
          handler.set('key', 'value');
          handler.set('key2', 'value');

          expect(handler.get('key')).toBe('value');
          expect(handler.get('key2')).toBe('value');

          handler.setMany(
            [
              ['key', 'value2'],
              ['key2', 'value2']
            ],
            false
          );

          expect(handler.get('key')).toBe('value');
          expect(handler.get('key2')).toBe('value');
        });

        test('GIVEN single row THEN skips row AND inserts row', () => {
          handler.set('key', 'value');

          expect(handler.get('key')).toBe('value');

          handler.setMany(
            [
              ['key', 'value2'],
              ['key2', 'value2']
            ],
            false
          );

          expect(handler.get('key')).toBe('value');
          expect(handler.get('key2')).toBe('value2');
        });
      });
    });

    describe('with size method', () => {
      test('GIVEN empty table THEN returns 0', () => {
        expect(handler.size()).toBe(0);
      });

      test('GIVEN single row THEN returns 1', () => {
        handler.set('key', 'value');

        expect(handler.size()).toBe(1);
      });

      test('GIVEN multiple rows THEN returns size', () => {
        handler.set('key', 'value');
        handler.set('key2', 'value');

        expect(handler.size()).toBe(2);
      });
    });

    describe('with values method', () => {
      test('GIVEN empty table THEN returns empty array', () => {
        expect(handler.values()).toEqual([]);
      });

      test('GIVEN single row THEN returns array', () => {
        handler.set('key', 'value');

        expect(handler.values()).toEqual(['value']);
      });

      test('GIVEN multiple rows THEN returns array', () => {
        handler.set('key', 'value');
        handler.set('key2', 'value');

        expect(handler.values()).toEqual(['value', 'value']);
      });
    });
  });
});
