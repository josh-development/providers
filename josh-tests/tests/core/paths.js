module.exports = {
  place: 8,
  name: 'Database can delete values and data at paths',
  async fn(provider) {
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
  },
};
