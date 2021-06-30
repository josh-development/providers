# MySQL Provider for JOSH

The MySQL provider uses mysql for persistent storage of JOSH data.

## Installation

I won't do a tuto yet on installation. There is lots of them on the internet, so google it.

## Usage

```js
const Josh = require('@joshdb/core');
const JoshMySQL = require('@joshdb/mysql');

const db = new Josh({
  name: 'testing',
  provider: JoshMySQL,
  providerOptions: {
    connection: {
      host: "localhost",
      user: "root",
      password: "pAsSwOrD1234",
      database: "mydb"
    }
  }
});

db.defer.then(async () => {
  console.log(`Connected, there are ${await db.size} rows in the database.`);
});
```

### Parameters

- `connection` : this field is required, it is your database connection options. Note that josh-mysql will not create a database for you, but tables will automatically be created. ([See all available parameters](https://www.npmjs.com/package/mysql#connection-options))