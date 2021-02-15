module.exports = {
  place: 12,
  name: 'Database can be closed',
  async fn(provider) {
    await provider.close();
  },
};
