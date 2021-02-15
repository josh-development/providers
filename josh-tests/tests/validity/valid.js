module.exports = {
  place: 1,
  name: 'Database instance is valid',
  fn(provider) {
    expect(provider).not.toBe(null);
  },
};
