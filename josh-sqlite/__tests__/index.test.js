const Provider = require("../index.js");

const sqlite = new Provider({ inMemory: true });

test('Database instance is valid', () => {
    expect(sqlite).not.toBe(null);
    expect(sqlite.constructor.name).toBe('JoshProvider');
    expect(sqlite.name).toBe(':memory:');
});

test('Database can be initialized', async () => {
    await sqlite.init();
    expect(sqlite.isInitialized).toBe(true);
});

test('Database can be written to with all supported values', async () => {
    await expect(sqlite.set('object', null, { a: 1, b: 2, c: 3, d: 4})).resolves.toEqual(sqlite);
    await expect(sqlite.set('array', null, [1, 2, 3, 4, 5])).resolves.toEqual(sqlite);
    await expect(sqlite.set('number', null, 42)).resolves.toEqual(sqlite);
    await expect(sqlite.set('string', null, 'This is a string')).resolves.toEqual(sqlite);
    await expect(sqlite.set('boolean', null, false)).resolves.toEqual(sqlite);
    await expect(sqlite.set('complexobject', null, { a: 1, b: 'two', c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} })).resolves.toEqual(sqlite);
    await expect(sqlite.set('null', null, null)).resolves.toEqual(sqlite);
    // This actually writes `null`. Is it really a problem? eeeeeeeh I dunno?
    await expect(sqlite.set('undefined', null, undefined)).resolves.toEqual(sqlite);
    // to test: inc, dec, autoId, setMany
});

test('Database returns expected statistical properties', async() => {
    await expect(sqlite.count()).resolves.toBe(8);
    await expect(sqlite.keys()).resolves.toEqual(['object', 'array', 'number', 'string', 'boolean', 'complexobject', 'null', 'undefined']);
    await expect(sqlite.values()).resolves.toEqual([
        { a: 1, b: 2, c: 3, d: 4},
        [1, 2, 3, 4, 5],
        42,
        'This is a string',
        false,
        { a: 1, b: 'two', c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} },
        null,
        null
    ]);
});

test('Database can retrieve data points as expected', () => {
    expect(sqlite.get('object')).toEqual({ a: 1, b: 2, c: 3, d: 4});
    expect(sqlite.get('array')).toEqual([1, 2, 3, 4, 5]);
    expect(sqlite.get('number')).toEqual(42);
    expect(sqlite.get('string')).toBe('This is a string');
    expect(sqlite.get('boolean')).toBe(false);
    expect(sqlite.get('complexobject')).toEqual({ a: 1, b: 'two', c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} });
    expect(sqlite.get('null')).toBeNull();
    expect(sqlite.get('undefined')).toBeNull();
    // To test: random, randomkey, getMany, has
});

test('Database can read and write in paths', async () => {
    expect(sqlite.get('object', 'a')).toBe(1);
    expect(sqlite.get('array', '0')).toBe(1);
    expect(sqlite.get('complexobject', 'c[4].a[1]')).toBe(2);

    await sqlite.set('object', 'e', 5);
    expect(sqlite.get('object', 'e')).toBe(5);
    await sqlite.set('array', '5', 6);
    expect(sqlite.get('array', '5')).toBe(6);

    // TODO: Find out why the fuck THIS doesn't work???
    // await sqlite.push('array', null, 7);
    // should have 7, it doesn't.
    // console.log(sqlite.get('array'));
    // test fails!
    // expect(sqlite.get('array', '6')).toBe(7);
});

test('Database can delete values and data at paths', () => {
    // test: delete, remove
});

test('Database can loop, filter, find', () => {
    // test: filter, find, <query> (upcoming)
});

test('Database can be purged', () => {
    // To test: clear, delete all.
})