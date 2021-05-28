const Provider = require('../index.js');
const JoshTests = require('../../../josh-tests');
// That won't work because you have to provide your own MySQL connection and deploy a database and ok...
const provider = new Provider({ inMemory: true });

const tests = new JoshTests(provider);

tests.start();
