module.exports = {
  place: 9,
  name: 'Database can loop, filter, find',
  async fn(provider) {
    expect(await provider.filterByValue('b', 2)).toEqual({
      object: { a: 1, b: 2, c: 3, d: 4 },
      complexobject: {
        a: 1,
        b: 2,
        c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
        d: { 1: 'one', 2: 'two' },
      },
    });
    expect(await provider.filterByValue(null, 42)).toEqual({ number: 42 });
    expect(await provider.findByValue('c', 3)).toEqual({
      object: {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
      },
    });
    expect(await provider.findByValue(null, 42)).toEqual({ number: 42 });
    for (let i = 0; i < 200; i++) {
      await provider.set(`object${i}`, null, { count: Number(i) });
    }
    expect(
      Object.keys(await provider.filterByFunction((v) => v && v.count >= 100))
        .length,
    ).toBe(100);
    expect(await provider.findByFunction((v) => v && v.count === 101)).toEqual({
      object101: { count: 101 },
    });
  },
};
