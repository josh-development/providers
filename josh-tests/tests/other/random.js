module.exports = {
  name: 'Database can retrieve random documents',
  place: 4,
  async fn(provider) {
    expect(Object.entries(await provider.random()).length).toBe(1);
    expect(Object.entries(await provider.random(2)).length).toEqual(2);
    expect(Object.entries(await provider.randomKey()).length).toEqual(1);
    expect(Object.entries(await provider.randomKey(2)).length).toEqual(2);
  },
};
