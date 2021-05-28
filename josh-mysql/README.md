# MySQL Provider for JOSH

The MySQL provider uses mysql for persistent storage of JOSH data.

## Installation

I won't do a tuto yet on installation. There is lots of them on the internet, so google it.

## Usage

Mysql providers don't create connection for you. You must create it manually like that :

```js
const Josh = require('@joshdb/core');
const JoshMySQL = require('@joshdb/mysql');
const { createConnection } = require("mysql");

const connection = createConnection({
  host: "localhost",
  user: "root",
  password: "pAsSwOrD1234",
  database: "mydb"
})

const db = new Josh({
  name: 'testing',
  provider: JoshMySQL,
  providerOptions: {
    connection: connection
  }
});

db.defer.then( async () => {
  console.log(`Connected, there are ${await db.size} rows in the database.`);
});
```

The `database` field is required. So you must create it before running the code.
That allows you to use the same connection for multiple JOSHs (multiple SQL tables)
