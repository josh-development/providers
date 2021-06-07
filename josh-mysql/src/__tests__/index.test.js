const Provider = require('../index.js');
const JoshTests = require('../../../josh-tests');

// You must create your own db to test it
const provider = new Provider({
    name: "tests",
    connection: {
        host: "",
        user: "",
        password: "",
        database: "",
        charset: "utf8_general_ci" // I recommand using it to ensure that all data will correctly be saved
    }
    // Or a url like :
    // connection: "mysql://user:passwd@host/db?charset=utf8_general_ci"
});

const tests = new JoshTests(provider);

tests.start();
