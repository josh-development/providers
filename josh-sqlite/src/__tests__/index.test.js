const Provider = require('../index.js');
const JoshTests = require('../../../josh-tests');
const provider = new Provider({ inMemory: true });

const tests = new JoshTests(provider);

tests.start();
