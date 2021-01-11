const Provider = require('../index.js');
const config = require('./config-mongo.json');
const privateConfig = require('./config-private.json');
/* config-mongo.json example contents
{
  "name": "josh",
  "url": "mongodb+srv://<username>:<password>@cluster0.0zbvd.mongodb.net/<dbName>?retryWrites=true&w=majority"
}

NOTES:
- The above refers to using Mongo Atlas for testing. Make sure to use the full URL that results from going to:
  - Your Cluster
  - Command Line Tools
  - Connect Instructions
  - Connection your Application (2nd option)
  - Select NodeJS Driver, version 3.0
  - Copy that string, replacing the username,password,dbname as necessary.

- This testing WILL DELETE THE ENTIRE COLLECTION CONTENT, so do NOT connect this to a live collection OMG what's wrong with you!
*/

if (!config || !config.collection) {
  console.error('No configuration detected, please create config-mongo.json');
  process.exit(1);
}

const provider = new Provider(privateConfig || config);

jest.setTimeout(30000);

afterAll(() => provider.close());

test('Database instance is valid', () => {
  expect(provider).not.toBe(null);
  expect(provider.collection).toBe('josh');
});

test('Database can be initialized', async () => {
  await provider.init();
  await provider.clear();
  expect(await provider.count()).toBe(0);
});

test('Database can be written to with all supported values', async () => {
  expect(
    await provider.set('object', null, { a: 1, b: 2, c: 3, d: 4 }),
  ).toEqual(provider);
  expect(await provider.set('array', null, [1, 2, 3, 4, 5])).toEqual(provider);
  expect(await provider.set('number', null, 42)).toEqual(provider);
  expect(await provider.set('string', null, 'This is a string')).toEqual(
    provider,
  );
  expect(await provider.set('boolean', null, false)).toEqual(provider);
  expect(
    await provider.set('complexobject', null, {
      a: 1,
      b: 2,
      c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
      d: { 1: 'one', 2: 'two' },
    }),
  ).toEqual(provider);
  expect(await provider.set('null', null, null)).toEqual(provider);

  expect(await provider.set('object', 'd', 5)).toEqual(provider);

  await provider.inc('number');
  expect(await provider.get('number')).toBe(43);
  await provider.dec('number');
  expect(await provider.get('number')).toBe(42);
  await provider.inc('object', 'a');
  expect(await provider.get('object', 'a')).toBe(2);
  await provider.dec('object', 'a');
  expect(await provider.get('object', 'a')).toBe(1);
});

test('Database can retrieve data points as expected', async () => {
  expect(await provider.get('object')).toEqual({ a: 1, b: 2, c: 3, d: 5 });
  expect(await provider.get('object', 'd')).toEqual(5);
  expect(await provider.set('object', 'd', 4)).toEqual(provider);
  expect(await provider.get('object')).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  expect(await provider.get('array')).toEqual([1, 2, 3, 4, 5]);
  expect(await provider.get('number')).toEqual(42);
  expect(await provider.get('string')).toBe('This is a string');
  expect(await provider.get('boolean')).toBe(false);
  expect(await provider.get('complexobject')).toEqual({
    a: 1,
    b: 2,
    c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
    d: { 1: 'one', 2: 'two' },
  });
  expect(await provider.get('null')).toBeNull();
  expect((await provider.random())[0].length).toEqual(2);
  expect((await provider.random(2)).length).toEqual(2);
  expect((await provider.randomKey()).length).toEqual(1);
  expect((await provider.randomKey(2)).length).toEqual(2);
  // expect(await provider.random()).toNotBeNull();
});

test('Database returns expected statistical properties', async () => {
  expect(await provider.count()).toBe(7);
  expect((await provider.keys()).sort()).toEqual([
    'array',
    'boolean',
    'complexobject',
    'null',
    'number',
    'object',
    'string',
  ]);
  expect((await provider.values()).sort()).toEqual([
    [1, 2, 3, 4, 5],
    42,
    'This is a string',
    { a: 1, b: 2, c: 3, d: 4 },
    {
      a: 1,
      b: 2,
      c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
      d: { 1: 'one', 2: 'two' },
    },
    false,
    null,
  ]);
});

test('Database can act on many rows at a time', async () => {
  expect(await provider.getMany(['number', 'boolean'])).toEqual([
    ['number', 42],
    ['boolean', false],
  ]);
  expect(await provider.getAll()).toEqual([
    ['object', { a: 1, b: 2, c: 3, d: 4 }],
    ['array', [1, 2, 3, 4, 5]],
    ['number', 42],
    ['string', 'This is a string'],
    ['boolean', false],
    [
      'complexobject',
      {
        a: 1,
        b: 2,
        c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
        d: { 1: 'one', 2: 'two' },
      },
    ],
    ['null', null],
  ]);
  expect(
    await provider.setMany([
      ['new1', 'new1'],
      ['new2', 'new2'],
    ]),
  ).toEqual(provider);
  expect(await provider.setMany([['new1', 'new2']])).toEqual(provider);
  expect(await provider.get('new1')).toBe('new1');
  expect(await provider.setMany([['new1', 'new2']], true)).toEqual(provider);
  expect(await provider.get('new1')).toBe('new2');
  expect(await provider.count()).toBe(9);
  expect((await provider.keys()).sort()).toEqual(
    [
      'string',
      'boolean',
      'complexobject',
      'null',
      'number',
      'object',
      'array',
      'new1',
      'new2',
    ].sort(),
  );
});

test('Database supports math operations', async () => {
  await provider.math('number', null, 'multiply', 2);
  expect(await provider.get('number')).toBe(84);
  await provider.math('number', null, 'divide', 4);
  expect(await provider.get('number')).toBe(21);
  await provider.math('number', null, 'add', 21);
  expect(await provider.get('number')).toBe(42);
});

test('Database can delete values and data at paths', async () => {
  await provider.delete('new2');
  expect(await provider.count()).toBe(8);
  expect((await provider.keys()).sort()).toEqual(
    [
      'string',
      'boolean',
      'complexobject',
      'null',
      'number',
      'object',
      'array',
      'new1',
    ].sort(),
  );

  await provider.setMany([
    ['del1', 'del1'],
    ['del2', 'del2'],
  ]);
  expect(await provider.count()).toBe(10);
  await provider.deleteMany(['del1', 'del2']);
  expect(await provider.count()).toBe(8);
  await provider.delete('object', 'a');
  expect(await provider.get('object', 'a')).toBe(undefined);
  await provider.set('object', 'a', 1);
});

test('Database can loop, filter, find', async () => {
  expect(await provider.filterByValue('b', 2)).toEqual([
    ['object', { a: 1, b: 2, c: 3, d: 4 }],
    [
      'complexobject',
      {
        a: 1,
        b: 2,
        c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
        d: { 1: 'one', 2: 'two' },
      },
    ],
  ]);
  expect(await provider.filterByValue(null, 42)).toEqual([['number', 42]]);
  expect(await provider.findByValue('c', 3)).toEqual([
    'object',
    {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
    },
  ]);
  expect(await provider.findByValue(null, 42)).toEqual(['number', 42]);
  // add a bunch of rows for function filter/find
  for (let i = 0; i < 200; i++) {
    await provider.set(`object${i}`, 'count', Number(i));
  }
  expect(
    Object.keys(await provider.filterByFunction((v) => v && v.count >= 100))
      .length,
  ).toBe(100);
  expect((await provider.findByFunction((v) => v && v.count === 101))[0]).toBe(
    'object101',
  );
});

test('Database can push, remove, map, include, autoid and some', async () => {
  expect(await provider.push('array', null, 'pushed')).toBe(provider);
  expect(await provider.get('array')).toEqual([1, 2, 3, 4, 5, 'pushed']);
  expect(await provider.remove('array', null, 'pushed'));
  expect(await provider.get('array')).toEqual([1, 2, 3, 4, 5]);
  expect(await provider.includes('array', null, 3)).toEqual(true);
  expect(await provider.includes('array', null, 10)).toEqual(false);
  expect(await provider.mapByFunction(([key]) => key)).toEqual(
    await provider.keys(),
  );
  expect(await provider.someByValue(42)).toBe(true);
  expect(await provider.someByValue(3, 'c')).toBe(true);
  expect(await provider.someByFunction(([key]) => key == 'number')).toBe(true);
  expect(await provider.everyByValue(42)).toBe(false);
  expect(await provider.everyByFunction(([key]) => key != null)).toBe(true);
  expect((await provider.autoId()) != (await provider.autoId())).toBe(true);
});

test('Database can be deleted', async () => {
  await provider.clear();
  expect(await provider.count()).toBe(0);
});

test('Database can be closed', async () => {
  await provider.close();
});

test("Database can't be used after close", async () => {
  await expect(provider.set('test', null, 'test')).rejects.toThrowError(
    'Connection to database not open',
  );
});
