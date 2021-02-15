module.exports = {
  place: 13,
  name: "Database can't be used after close",
  async fn(provider) {
    let promise = new Promise(async (res, rej) => {
      try {
        await provider.set('test', null, 'test');
        res();
      } catch (err) {
        rej(err);
      }
    });
    await expect(promise).rejects.toThrowError();
  },
};
