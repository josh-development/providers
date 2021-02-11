module.exports = {
  place: 2,
  async fn(provider) {
    expect(
      await provider.set('object', null, { a: 1, b: 2, c: 3, d: 4 }),
    ).toEqual(provider);
    expect(await provider.set('array', null, [1, 2, 3, 4, 5])).toEqual(
      provider,
    );
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
  },
  name: 'Database can be written to with all supported values',
};
