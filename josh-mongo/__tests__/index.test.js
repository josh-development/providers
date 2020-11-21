const Provider = require("../index.js");

const provider = new Provider({ inMemory: true });

test('Database instance is valid', () => {
    expect(provider).not.toBe(null);
    expect(provider.constructor.name).toBe('JoshProvider');
    expect(provider.name).toBe('InMemoryJosh');
});

test('Database can be initialized', () => {
    provider.init();
    expect(provider.isInitialized).toBe(true);
});

test('Database can be written to with all supported values', () => {
    expect(provider.set('object', null, { a: 1, b: 2, c: 3, d: 4})).toEqual(provider);
    expect(provider.set('array', null, [1, 2, 3, 4, 5])).toEqual(provider);
    expect(provider.set('number', null, 42)).toEqual(provider);
    expect(provider.set('string', null, 'This is a string')).toEqual(provider);
    expect(provider.set('boolean', null, false)).toEqual(provider);
    expect(provider.set('complexobject', null, { a: 1, b: 2, c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} })).toEqual(provider);
    expect(provider.set('null', null, null)).toEqual(provider);

    provider.inc('number');
    expect(provider.get('number')).toBe(43);
    provider.dec('number');
    expect(provider.get('number')).toBe(42);
});

test('Database returns expected statistical properties', async() => {
    expect(provider.count()).toBe(7);
    // order is weird because jest can't compare arrays in an unordered fashion.
    expect(provider.keys()).toEqual(['object', 'array', 'string', 'boolean', 'complexobject', 'null', 'number']);
    expect(provider.values()).toEqual([
        { a: 1, b: 2, c: 3, d: 4},
        [1, 2, 3, 4, 5],
        'This is a string',
        false,
        { a: 1, b: 2, c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} },
        null,
        42,
    ]);
    expect(provider.autoId()).toBe("1");
    expect(provider.autoId()).toBe("2");
});

test('Database can retrieve data points as expected', async () => {
    expect(provider.get('object')).toEqual({ a: 1, b: 2, c: 3, d: 4});
    expect(provider.get('array')).toEqual([1, 2, 3, 4, 5]);
    expect(provider.get('number')).toEqual(42);
    expect(provider.get('string')).toBe('This is a string');
    expect(provider.get('boolean')).toBe(false);
    expect(provider.get('complexobject')).toEqual({ a: 1, b: 2, c: [1, 2, 3, 4, {a: [1, 2, 3, 4]}], d: {1: 'one', 2: 'two'} });
    expect(provider.get('null')).toBeNull();
    expect(provider.has('object','a')).toBe(true);
});

test('Database can read and write in paths', () => {
    expect(provider.get('object', 'a')).toBe(1);
    expect(provider.get('array', '0')).toBe(1);
    expect(provider.get('complexobject', 'c[4].a[1]')).toBe(2);

    provider.set('object', 'e', 5);
    expect(provider.get('object', 'e')).toBe(5);
    provider.set('array', '5', 6);
    expect(provider.get('array', '5')).toBe(6);

    provider.push('array', null, 7);
    expect(provider.get('array', '6')).toBe(7);
});

test('Database can act on many rows at a time', async () => {
    expect(provider.getMany(['number', 'boolean'])).toEqual({ 'number': 42, 'boolean': false });
    expect(provider.setMany([['new1', 'new1'], ['new2', 'new2']])).toEqual(provider);
    expect(provider.count()).toBe(9);
    expect(provider.keys()).toEqual(['string', 'boolean', 'complexobject', 'null', 'number', 'object', 'array', 'new1', 'new2']);
});

test('Database can delete values and data at paths', () => {
    // Delete
    provider.delete('new2');
    expect(provider.count()).toBe(8);
    expect(provider.keys()).toEqual(['string', 'boolean', 'complexobject', 'null', 'number', 'object', 'array', 'new1']);

    // Objects
    provider.delete('object', 'a');
    expect(provider.count()).toBe(8);
    expect(provider.get('object')).toEqual({ b: 2, c: 3, d: 4, e: 5});

    // Arrays 
    provider.remove('array', null, 4);
    expect(provider.get('array')).toEqual([1, 2, 3, 5, 6, 7]);
});

test('Database supports math operations', () => {
    provider.math('number', null, 'multiply', 2);
    expect(provider.get('number')).toBe(84);
    provider.math('number', null, 'divide', 4);
    expect(provider.get('number')).toBe(21);
    provider.math('number', null, 'add', 21);
    expect(provider.get('number')).toBe(42);
})

test('Database can loop, filter, find', () => {
    expect(provider.filterByValue('b', 2)).toEqual({
        object: { b: 2, c: 3, d: 4, e: 5 },
        complexobject: {
            a: 1,
            b: 2,
            c: [ 1, 2, 3, 4,  {a: [1, 2, 3, 4]} ],
            d: { '1': 'one', '2': 'two' }
        }
    });
    expect(provider.findByValue('c', 3)).toEqual({
        object: { b: 2, c: 3, d: 4, e: 5 }
    });
    // test: <query> (upcoming)
});

test('Database can be purged and destroyed', () => {
    provider.clear();
    expect(provider.count()).toBe(0);

    provider.destroy();
    // THIS NEEDS TO BE ADJUSTED FOR EACH PROVIDER
    expect(() => provider.count()).toThrowError(new Error('no such table: InMemoryJosh'));
})