# Getting started with contributing your own provider for Josh

This page will help guide you through the process of creating and contributing your own provider to the Josh database wrapper project. We are glad that you would like to contribute to our amazing project. Please follow these instructions carefully to help ensure your contributions are accepted.

## Prerequisites

To be able to contribute your own provider for this project you are required to have extensive knowledge with [TypeScript](https://www.typescriptlang.org). In order to get your workspace ready you will need to follow the steps in [`CONTRIBUTING.md`](.github/CONTRIBUTING.md).

## Getting Started

To get started you will need to run a few commands in command line.

```sh
# Initiate Yarn in this repository.
yarn

# Navigate to the "packages/" directory.
cd packages

# Create the directory for your provider package.
mkdir provider

# Navigate to your provider's directory.
cd provider
```

Now that you have an empty directory, let's fill it with tools for development. For this we can reference any of the already contributed packages (e.g. `packages/mongo`). We will call this package `mongo` for this example.

```sh
# Copy the package file.
copy ../mongo/package.json package.json

# Copy the Jest config file.
copy ../mongo/jest.config.ts jest.config.ts

# Copy the base tsconfig file.
copy ../mongo/tsconfig.base.json tsconfig.base.json

# Copy the eslint tsconfig file.
copy ../mongo/tsconfig.eslint.json tsconfig.eslint.json
```

Create the `src/` and `tests/` directories for our workspace.

```sh
# Create the "src/" directory.
mkdir src

# Create the "tests/" directory.
mkdir tests
```

In our new directories create a file called `tsconfig.json` and paste the following content for each.

### `tests/tsconfig.json`

```json
{
	"extends": "../tsconfig.base.json"
}
```

### `src/tsconfig.json`

```json
{
	"extends": "../tsconfig.base.json",
	"compilerOptions": {
		"rootDir": "./",
		"outDir": "../dist",
		"composite": true,
		"preserveConstEnums": true,
		"useDefineForClassFields": false
	},
	"include": ["."]
}
```

Now let's get started actually developing your new provider! In the `src/` directory create a file called `index.ts`, we are using a named export called `version`, the string inserted here will be replaced with the version of the package from the relative `package.json` file. Insert the following content into the newly created file.

```typescript
export const version = '[VI]{version}[/VI]';
```

This is where you'll be re-exporting your provider and other source files. Here is an example:

```typescript
export * from './lib/Provider.ts';

export const version = '[VI]{version}[/VI]';
```

## Up Next - [Writing Your Provider](WritingYourProvider.md)

## References

- [TypeScript](https://www.typescriptlang.org)
- [`CONTRIBUTING.md`](.github/CONTRIBUTING.md)
