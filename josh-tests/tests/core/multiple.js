module.exports = {
  name: 'Database can act on many rows at a time',
  place: 6,
  async fn(provider) {
    expect(await provider.getMany(['number', 'boolean'])).toEqual({
      number: 42,
      boolean: false,
    });
    expect(await provider.getAll()).toEqual({
      object: { a: 1, b: 2, c: 3, d: 4 },
      array: [1, 2, 3, 4, 5],
      number: 42,
      string: 'This is a string',
      boolean: false,

      complexobject: {
        a: 1,
        b: 2,
        c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
        d: { 1: 'one', 2: 'two' },
      },

      null: null,
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
  },
};
