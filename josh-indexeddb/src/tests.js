const Provider = require('./index.js');

const provider = new Provider();

const expect = (input) => {
  input = JSON.stringify(input);
  return {
    toBe: (expec) => {
      expec = JSON.stringify(expec);
      if (input !== expec) {
        throw new Error(input + ' was received, expected: ' + expec);
      }
    },
    toEqual: (expec) => {
      expec = JSON.stringify(expec);
      if (input !== expec) {
        console.log(input, '\n\n', expec);
        throw new Error(input + ' was received, expected: ' + expec);
      }
    },
  };
};

(async () => {
  console.log('Database instance is valid');

  console.log('Database can be initialized');
  await provider.init();
  await provider.clear();
  expect(await provider.count()).toBe(0);

  console.log('Database can be written to with all supported values');
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

  console.log('Database can retrieve data points as expected');
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
  expect(await provider.get('null')).toBe(null);
  expect(Object.entries(await provider.random()).length).toBe(1);
  expect(Object.entries(await provider.random(2)).length).toEqual(2);
  expect(Object.entries(await provider.randomKey()).length).toEqual(1);
  expect(Object.entries(await provider.randomKey(2)).length).toEqual(2);
  // expect(await provider.random()).toNotBeNull()

  console.log('Database returns expected statistical properties');
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
    {
      a: 1,
      b: 2,
      c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
      d: { 1: 'one', 2: 'two' },
    },
    { a: 1, b: 2, c: 3, d: 4 },
    false,
    null,
  ]);

  console.log('Database can act on many rows at a time');
  expect(await provider.getMany(['number', 'boolean'])).toEqual({
    boolean: false,
    number: 42,
  });
  expect(await provider.getAll()).toEqual({
    array: [1, 2, 3, 4, 5],
    boolean: false,
    complexobject: {
      a: 1,
      b: 2,
      c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
      d: { 1: 'one', 2: 'two' },
    },
    null: null,
    number: 42,
    object: { a: 1, b: 2, c: 3, d: 4 },
    string: 'This is a string',
  });
  expect(
    await provider.setMany({
      new1: 'new1',
      new2: 'new2',
    }),
  ).toEqual(provider);
  expect(await provider.setMany({ new1: 'new2' })).toEqual(provider);
  expect(await provider.get('new1')).toBe('new1');
  expect(await provider.setMany({ new1: 'new2' }, true)).toEqual(provider);
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

  console.log('Database supports math operations');
  await provider.math('number', null, 'multiply', 2);
  expect(await provider.get('number')).toBe(84);
  await provider.math('number', null, 'divide', 4);
  expect(await provider.get('number')).toBe(21);
  await provider.math('number', null, 'add', 21);
  expect(await provider.get('number')).toBe(42);

  console.log('Database can delete values and data at paths');
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

  await provider.setMany({
    del1: 'del1',
    del2: 'del2',
  });
  expect(await provider.count()).toBe(10);
  await provider.deleteMany(['del1', 'del2']);
  expect(await provider.count()).toBe(8);
  await provider.delete('object', 'a');
  expect(await provider.get('object', 'a')).toBe(undefined);
  await provider.set('object', 'a', 1);

  console.log('Database can loop, filter, find');
  expect(await provider.filterByValue('b', 2)).toEqual([
    [
      'complexobject',
      {
        a: 1,
        b: 2,
        c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
        d: { 1: 'one', 2: 'two' },
      },
    ],
    ['object', { b: 2, c: 3, d: 4, a: 1 }],
  ]);
  expect(await provider.filterByValue(null, 42)).toEqual([['number', 42]]);
  expect(await provider.findByValue('c', 3)).toEqual([
    'object',
    { b: 2, c: 3, d: 4, a: 1 },
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

  console.log('Database can push, remove, map, include, autoid and some');
  expect(await provider.push('array', null, 'pushed')).toBe(provider);
  expect(await provider.get('array')).toEqual([1, 2, 3, 4, 5, 'pushed']);
  expect(await provider.remove('array', null, 'pushed'));
  expect(await provider.get('array')).toEqual([1, 2, 3, 4, 5]);
  expect(await provider.includes('array', null, 3)).toEqual(true);
  expect(await provider.includes('array', null, 10)).toEqual(false);
  expect(await provider.mapByFunction((value) => value)).toEqual(
    await provider.values(),
  );
  expect(await provider.someByValue(42)).toBe(true);
  expect(await provider.someByValue(3, 'c')).toBe(true);
  expect(
    await provider.someByFunction((value, key) => value && key == 'number'),
  ).toBe(true);
  expect(await provider.everyByValue(42)).toBe(false);
  expect(await provider.everyByFunction((value) => value != 'WOAH')).toBe(true);
  expect((await provider.autoId()) != (await provider.autoId())).toBe(true);

  console.log('Database can be deleted');
  await provider.clear();
  expect(await provider.count()).toBe(0);

  console.log('Database can be closed');
  await provider.close();
})();
window.db = provider;

module.exports = {};
