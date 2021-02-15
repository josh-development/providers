# Josh Provider Tests

THIS IS NOT A PROVIDER - this folder contains tests for the providers

## How to add a test

Add the file in its directory of tests/ with this template:

```js
module.exports = {
  place: 0, // This is the priority of the test, if other tests rely on it make sure its priority is lower than those tests
  name: 'Description of test as seen in other files',
  async fn(provider) {
    // can be async or sync
  },
};
```
