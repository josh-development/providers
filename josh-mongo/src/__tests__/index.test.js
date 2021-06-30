const Provider = require('../index.js');
const config = require('./config-mongo.json');
const JoshTests = require('../../../josh-tests');
/* config-mongo.json example contents
{
  "name": "josh",
  "url": "mongodb+srv://<username>:<password>@cluster0.0zbvd.mongodb.net/<dbName>?retryWrites=true&w=majority"
}

NOTES:
- The above refers to using Mongo Atlas for testing. Make sure to use the full URL that results from going to:
  - Your Cluster
  - Command Line Tools
  - Connect Instructions
  - Connection your Application (2nd option)
  - Select NodeJS Driver, version 3.0
  - Copy that string, replacing the username,password,dbname as necessary.

- This testing WILL DELETE THE ENTIRE COLLECTION CONTENT, so do NOT connect this to a live collection OMG what's wrong with you!
*/

if (!config || !config.collection) {
  console.error('No configuration detected, please create config-mongo.json');
  process.exit(1);
}

const provider = new Provider(require('./config-private.json') || config);

const tests = new JoshTests(provider);

tests.start();
