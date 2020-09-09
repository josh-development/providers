const Provider = require("../index.js");

const sqlite = new Provider({ inMemory: true });

test('Database instance is valid', () => {
    expect(sqlite).not.toBe(null);
    expect(sqlite.constructor.name).toBe('JoshProvider');
    expect(sqlite.name).toBe(':memory:');
});

test('Database can be initialized', () => {
    sqlite.init();
    expect(sqlite.isInitialized).toBe(true);
});

test('Database can be written to with all supported values', () => {
    expect(sqlite.set('object', null, { a: 1, b: 2, c: 3, d: 4})).toEqual(sqlite);
    expect(sqlite.set('array', null, [1, 2, 3, 4, 5])).toEqual(sqlite);
    expect(sqlite.set('number', null, 42)).toEqual(sqlite);
    expect(sqlite.set('string', null, 'This is a string')).toEqual(sqlite);
    expect(sqlite.set('boolean', null, false)).toEqual(sqlite);
    expect(sqlite.set('complexobject', null, { a: 1, b: 2, c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} })).toEqual(sqlite);
    expect(sqlite.set('null', null, null)).toEqual(sqlite);

    sqlite.inc('number');
    expect(sqlite.get('number')).toBe(43);
    sqlite.dec('number');
    expect(sqlite.get('number')).toBe(42);
});

test('Database returns expected statistical properties', async() => {
    expect(sqlite.count()).toBe(7);
    // order is weird because jest can't compare arrays in an unordered fashion.
    expect(sqlite.keys()).toEqual(['object', 'array', 'string', 'boolean', 'complexobject', 'null', 'number']);
    expect(sqlite.values()).toEqual([
        { a: 1, b: 2, c: 3, d: 4},
        [1, 2, 3, 4, 5],
        'This is a string',
        false,
        { a: 1, b: 2, c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} },
        null,
        42,
    ]);
    expect(sqlite.autoId()).toBe("1");
    expect(sqlite.autoId()).toBe("2");
});

test('Database can retrieve data points as expected', async () => {
    expect(sqlite.get('object')).toEqual({ a: 1, b: 2, c: 3, d: 4});
    expect(sqlite.get('array')).toEqual([1, 2, 3, 4, 5]);
    expect(sqlite.get('number')).toEqual(42);
    expect(sqlite.get('string')).toBe('This is a string');
    expect(sqlite.get('boolean')).toBe(false);
    expect(sqlite.get('complexobject')).toEqual({ a: 1, b: 2, c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} });
    expect(sqlite.get('null')).toBeNull();
    expect(sqlite.has('number')).toBe(true);
    expect(sqlite.has('object','a')).toBe(true);
});

test('Database can read and write in paths', () => {
    expect(sqlite.get('object', 'a')).toBe(1);
    expect(sqlite.get('array', '0')).toBe(1);
    expect(sqlite.get('complexobject', 'c[4].a[1]')).toBe(2);

    sqlite.set('object', 'e', 5);
    expect(sqlite.get('object', 'e')).toBe(5);
    sqlite.set('array', '5', 6);
    expect(sqlite.get('array', '5')).toBe(6);

    sqlite.push('array', null, 7);
    expect(sqlite.get('array', '6')).toBe(7);
});

test('Database can act on many rows at a time', async () => {
    expect(sqlite.getMany(['number', 'boolean'])).toEqual({ 'number': 42, 'boolean': false });
    expect(sqlite.setMany([['new1', 'new1'], ['new2', 'new2']])).toEqual(sqlite);
    expect(sqlite.count()).toBe(9);
    expect(sqlite.keys()).toEqual(['string', 'boolean', 'complexobject', 'null', 'number', 'object', 'array', 'new1', 'new2']);
});

test('Database can delete values and data at paths', () => {
    // Delete
    sqlite.delete('new2');
    expect(sqlite.count()).toBe(8);
    expect(sqlite.keys()).toEqual(['string', 'boolean', 'complexobject', 'null', 'number', 'object', 'array', 'new1']);

    // Objects
    sqlite.delete('object', 'a');
    expect(sqlite.count()).toBe(8);
    expect(sqlite.get('object')).toEqual({ b: 2, c: 3, d: 4, e: 5});

    // Arrays 
    // Fix this!
    // sqlite.remove('array', null, '4');
    // console.log(sqlite.get('array'));
});

test('Database can loop, filter, find', () => {
    expect(sqlite.filterByValue('b', 2)).toEqual({
        object: { b: 2, c: 3, d: 4, e: 5 },
        complexobject: {
            a: 1,
            b: 2,
            c: [ 1, 2, 3, 4,  {a: [1, 2, 3, 4]} ],
            d: { '1': 'one', '2': 'two' }
        }
    });
    expect(sqlite.findByValue('c', 3)).toEqual({
        object: { b: 2, c: 3, d: 4, e: 5 }
    });
    // test: <query> (upcoming)
});

test('Database can be purged', () => {
    sqlite.clear();
    expect(sqlite.count()).toBe(0);
})