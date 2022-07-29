<div align="center">

![Josh Logo](https://evie.codes/josh-light.png)

# @joshdb/mongo

**A provider for `@joshdb/core`**

[![GitHub](https://img.shields.io/github/license/josh-development/providers)](https://github.com/josh-development/providers/blob/main/LICENSE.md)
[![codecov](https://codecov.io/gh/josh-development/providers/branch/main/graph/badge.svg?token=JnJcjxqT3k)](https://codecov.io/gh/josh-development/providers)
[![npm](https://img.shields.io/npm/v/@joshdb/map?color=crimson&logo=npm&style=flat-square)](https://www.npmjs.com/package/@joshdb/mongo)

[![Support Server](https://discord.com/api/guilds/298508738623438848/embed.png?style=banner2)](https://discord.gg/N7ZKH3P)

</div>

## Description

Want to safely store your data in a mongo database? This is the package for you.

## Features

- Written in TypeScript
- Offers CommonJS and ESM bundles
- Fully tested

## Installation

You can use the following command to install this package, or replace `npm install` with your package manager of choice.

```sh
npm install @joshdb/mongo
```

## Provider Options

```typescript
interface Options {
  /**
   * The name of the mongoose collection to use
   * @since 2.0.0
   */
  collectionName?: string;

  /**
   * Mongoose connection options
   * @see https://mongodb.github.io/node-mongodb-native/4.5/interfaces/MongoClientOptions.html
   * @since 2.0.0
   */
  connectOptions?: Mongodb.ConnectOptions;

  /**
   * Sanitize collection name
   * @since 2.0.0
   */
  enforceCollectionName?: boolean;

  /**
   * Authentication for the database in string or object
   * @since 2.0.0
   */
  authentication?: Partial<Authentication> | string;

  /**
   * Disable using ``@joshdb/serialize`` for document serialization
   * This can be faster in some cases, but may cause issues with complex data types
   * @since 2.0.0
   */
  disableSerialization?: boolean;
}

interface Authentication {
  /**
   * The username for authentication.
   * @since 2.0.0
   */
  user?: string;

  /**
   * The password for authentication.
   * @since 2.0.0
   */
  password?: string;

  /**
   * The database name for authentication.
   * @since 2.0.0
   */
  dbName: string;

  /**
   * The database port for authentication.
   * @since 2.0.0
   */
  port: number;

  /**
   * The database host for authentication.
   * @since 2.0.0
   */
  host: string;
}
```
