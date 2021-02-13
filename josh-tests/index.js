const path = require('path');
const { fetchTests } = require('./utils');

class JoshProviderTests {
  constructor(provider) {
    this.precautions();
    this.provider = provider;
    this.tests = fetchTests(path.resolve(__dirname, 'tests'));
    return this;
  }
  precautions() {
    if (process.env.JEST_WORKER_ID === undefined)
      throw new Error('JoshTests was not run in a jest environment!');
    jest.setTimeout(30000);
  }
  start() {
    this.tests.sort((a, b) => a.place - b.place);
    afterAll(() => this.provider.close());
    for (let mod of this.tests) {
      if (!mod.name) return;
      test(mod.name, async () => {
        await mod.fn(this.provider);
      });
    }
  }
}

module.exports = JoshProviderTests;
