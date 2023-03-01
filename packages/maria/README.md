<div align="center">

![Josh Logo](https://evie.codes/josh-light.png)

# @joshdb/maria

**A provider for `@joshdb/core`**

[![GitHub](https://img.shields.io/github/license/josh-development/providers)](https://github.com/josh-development/providers/blob/main/LICENSE.md)
[![codecov](https://codecov.io/gh/josh-development/providers/branch/main/graph/badge.svg?token=JnJcjxqT3k)](https://codecov.io/gh/josh-development/providers)
[![npm](https://img.shields.io/npm/v/@joshdb/maria?color=crimson&logo=npm&style=flat-square)](https://www.npmjs.com/package/@joshdb/maria)

[![Support Server](https://discord.com/api/guilds/298508738623438848/embed.png?style=banner2)](https://discord.gg/N7ZKH3P)

</div>

## Description

A provider for @joshdb/core whichs uses MariaDB

## Features

- Written in TypeScript
- Offers CommonJS and ESM bundles
- Fully tested

## Installation

You can use the following command to install this package, or replace `npm install` with your package manager of choice.

```sh
npm install @joshdb/maria
```

## Provider Options

```typescript
export interface Options extends JoshProvider.Options {
  /**
   * The connection config for the MariaDB connection
   * @since 1.0.0
   */
  connectionConfig?: ConnectionConfig | string;

  /**
   * Whether to disable automatic data serialization with `better-serialize`.
   * @since 1.0.0
   */
  disableSerialization?: boolean;

  /**
   * The epoch used for `@sapphire/snowflake`.
   * @since 1.0.0
   */
  epoch?: number | bigint | Date;
}
```
