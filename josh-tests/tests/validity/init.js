module.exports = {
  place: 0,
  name: 'Database can be initialized',
  async fn(provider) {
    await provider.init();
    await provider.clear();
    expect(await provider.count()).toBe(0);
  },
};
