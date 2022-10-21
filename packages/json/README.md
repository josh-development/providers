<div align="center">

![Josh Logo](https://evie.codes/josh-light.png)

# @joshdb/json

**A provider for `@joshdb/core`**

[![GitHub](https://img.shields.io/github/license/josh-development/providers)](https://github.com/josh-development/providers/blob/main/LICENSE.md)
[![codecov](https://codecov.io/gh/josh-development/providers/branch/main/graph/badge.svg?token=JnJcjxqT3k)](https://codecov.io/gh/josh-development/providers)
[![npm](https://img.shields.io/npm/v/@joshdb/json?color=crimson&logo=npm&style=flat-square)](https://www.npmjs.com/package/@joshdb/json)

[![Support Server](https://discord.com/api/guilds/298508738623438848/embed.png?style=banner2)](https://discord.gg/N7ZKH3P)

</div>

## Description

Want to safely store your data in JSON files? This is the package for you.

## Features

- Written in TypeScript
- Offers CommonJS and ESM bundles
- Fully tested

## Installation

You can use the following command to install this package, or replace `npm install` with your package manager of choice.

```sh
npm install @joshdb/json
```

## Provider Options

```typescript
export interface Options extends JoshProvider.Options {
  /**
   * Whether to use treat the data directory as an absolute path.
   * @since 2.0.0
   */
  useAbsolutePath?: boolean;

  /**
   * The data directory to use.
   * @since 2.0.0
   */
  dataDirectory?: string;

  /**
   * Whether to disable data serialization with `@joshdb/serialize`.
   * @since 2.0.0
   */
  disableSerialization?: boolean;

  /**
   * The epoch used for `@sapphire/snowflake`.
   * @since 2.0.0
   */
  epoch?: number | bigint | Date;

  /**
   * The max chunk size to use.
   *
   * This is the maximum number of entries that can be stored in a single chunk file.
   * @since 2.0.0
   */
  maxChunkSize?: number;

  /**
   * The retry options to use.
   * @since 2.0.0
   */
  retry?: File.RetryOptions;

  /**
   * Whether to synchronize all data when the provider is initialized.
   * @since 2.0.0
   */
  synchronize?: boolean;
}
```
