const Provider = require('../index.js');
const JoshTests = require('../../../josh-tests');

const provider = new Provider();

jest.setTimeout(30000);

// afterAll(() => provider.close());

const tests = new JoshTests(provider);

tests.start();
