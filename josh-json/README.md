# JSON Provider for JOSH

The JSON provider uses the `atomically` module for persistent storage of JOSH data.

### Running the installer

In your project folder, you should be able to install using this command:

```
npm i @joshdb/json
** OR **
yarn add @joshdb/json
```

## Usage

Using the JSON provider goes as such:

```js
const Josh = require('@joshdb/core');
const JoshJSON = require('@joshdb/json');

const db = new Josh({
  name: 'testing',
  provider: JoshJSON,
  // See below for all provider options.
  providerOptions: {},
});

db.defer.then(async () => {
  console.log(`Connected, there are ${await db.size} rows in the database.`);
});
```

## Provider Options

Here is a list of full options this provider supports:

| Param                          | Type                 | Description                                                            |
| ------------------------------ | -------------------- | ---------------------------------------------------------------------- |
| [providerOptions]              | <code>Object</code>  | The Provider Options Object, with the below properties:                |
| [providerOptions.maxLength]    | <code>string</code>  | Optional, defaults to `100`. The amount of entries per json chunk file |
| [providerOptions.dataDir]      | <code>string</code>  | Optional, defaults to `data`. The location for the stored json files   |
| [providerOptions.indexAll]     | <code>boolean</code> | Optional, defaults to `false`. Adds new keys from the stored json files |
| [providerOptions.cleanupEmpty] | <code>boolean</code> | Optional, defaults to `false`. Cleans out empty keys from index file   |
