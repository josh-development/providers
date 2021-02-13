module.exports = {
  name: 'Database can retrieve data points as expected',
  place: 3,
  async fn(provider) {
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
  },
};
