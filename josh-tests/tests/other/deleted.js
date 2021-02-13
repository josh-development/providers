module.exports = {
  place: 11,
  name: 'Database can be deleted',
  async fn(provider) {
    await provider.clear();
    expect(await provider.count()).toBe(0);
  },
};
