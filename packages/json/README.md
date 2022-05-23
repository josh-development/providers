<div align="center">

![Josh Logo](https://evie.codes/josh-light.png)

# @joshdb/json

**A provider for `@joshdb/core`**

[![GitHub](https://img.shields.io/github/license/josh-development/providers)](https://github.com/josh-development/providers/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@joshdb/json?color=crimson&logo=npm&style=flat-square&label=@joshdb/json)](https://www.npmjs.com/package/@joshdb/json)

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
interface Options {
  /**
   * The directory name for data. Defaults to "data".
   * @since 2.0.0
   */
  dataDirectory?: string;

  /**
   * The max amount of keys in a single chunk. Defaults to 100.
   * @since 2.0.0
   */
  maxChunkSize?: number;

  /**
   * The epoch for chunk generation.
   * @since 2.0.0
   */
  epoch?: number | bigint | Date;

  /**
   * Whether to synchronize data when the provider is initiated.
   * @since 2.0.0
   */
  synchronize?: boolean;

  /**
   * The retry options for this provider to use.
   * @since 2.0.0
   */
  retry?: File.RetryOptions;
}
```
