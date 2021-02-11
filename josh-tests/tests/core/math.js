module.exports = {
  name: 'Database supports math operations',
  place: 7,
  async fn(provider) {
    await provider.math('number', null, 'multiply', 2);
    expect(await provider.get('number')).toBe(84);
    await provider.math('number', null, 'divide', 4);
    expect(await provider.get('number')).toBe(21);
    await provider.math('number', null, 'add', 21);
    expect(await provider.get('number')).toBe(42);
  },
};
