<div align="center">

![Josh Logo](https://evie.codes/josh-light.png)

# @joshdb/json

**A provider for `@joshdb/core`**

[![GitHub](https://img.shields.io/github/license/RealShadowNova/joshdb-providers)](https://github.com/RealShadowNova/joshdb-providers/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@joshdb/json?color=crimson&logo=npm&style=flat-square&label=@joshdb/json)](https://www.npmjs.com/package/@joshdb/json)

</div>

## Description

Want to safely store your data in JSON files? This is the package for you.

## Features

- Written in TypeScript
- Offers CommonJS and ESM bundles
- Fully tested

## Installation

### Using Yarn

```bash
yarn add RealShadowNova/joshdb-providers#build-json
```

### Using NPM

```bash
npm i RealShadowNova/joshdb-providers#build-json
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
