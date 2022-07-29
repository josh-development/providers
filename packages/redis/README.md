<div align="center">

![Josh Logo](https://evie.codes/josh-light.png)

# @joshdb/redis

**A provider for `@joshdb/core`**

[![GitHub](https://img.shields.io/github/license/josh-development/providers)](https://github.com/josh-development/providers/blob/main/LICENSE.md)
[![codecov](https://codecov.io/gh/josh-development/providers/branch/main/graph/badge.svg?token=JnJcjxqT3k)](https://codecov.io/gh/josh-development/providers)
[![npm](https://img.shields.io/npm/v/@joshdb/redis?color=crimson&logo=npm&style=flat-square)](https://www.npmjs.com/package/@joshdb/redis)

[![Support Server](https://discord.com/api/guilds/298508738623438848/embed.png?style=banner2)](https://discord.gg/N7ZKH3P)

</div>

## Description

Want to safely store your data in a redis database? This is the package for you.

## Features

- Written in TypeScript
- Offers CommonJS and ESM bundles
- Fully tested

## Installation

You can use the following command to install this package, or replace `npm install` with your package manager of choice.

```sh
npm install @joshdb/redis
```

## Provider Options

```typescript
interface Options {
  /**
   * Redis connection options
   * @see https://github.com/redis/node-redis/blob/master/docs/client-configuration.md#createclient-configuration
   * @since 2.0.0
   */
  connectOptions?: RedisClientOptions;

  /**
   * Expiration time for document entries (seconds)
   * @since 2.0.0
   */
  expiry?: number;

  /**
   * Disable using `@joshdb/serialize` for document serialization
   * This can be faster in some cases, but may cause issues with complex data types
   * @since 2.0.0
   */
  disableSerialization?: boolean;
}
```
