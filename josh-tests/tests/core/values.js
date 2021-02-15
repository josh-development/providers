module.exports = {
  name: 'Database returns expected statistical properties',
  place: 5,
  async fn(provider) {
    expect(await provider.count()).toBe(7);
    expect((await provider.keys()).sort()).toEqual(
      Object.keys(await provider.getAll()).sort(),
    );
    expect((await provider.values()).sort()).toEqual(
      Object.values(await provider.getAll()).sort(),
    );
  },
};
