module.exports = {
  place: 10,
  name: 'Database can push, remove, map, include, autoid and some',
  async fn(provider) {
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
    expect(await provider.someByValue('c', 3)).toBe(true);
    expect(
      await provider.someByFunction((value, key) => value && key == 'number'),
    ).toBe(true);
    expect(await provider.everyByValue(null, 42)).toBe(false);
    expect(await provider.everyByFunction((value) => value != 'WOAH')).toBe(
      true,
    );
    expect((await provider.autoId()) != (await provider.autoId())).toBe(true);
  },
};
