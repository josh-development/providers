# Contributing your own provider for Josh

This page will help guide you through the process of creating and contributing your own provider to the Josh database wrapper project. We are glad that you would like to contribute to our amazing project. Please follow these instructions carefully to help ensure your contributions are accepted.

## Prerequisites

To be able to contribute your own provider for this project you are required to have extensive knowledge with [TypeScript](https://www.typescriptlang.org). In order to get your workspace ready you will need to follow the steps in [`CONTRIBUTING.md`](.github/CONTRIBUTING.md).

## Getting Started

Please notice that this repository uses Yarn Workspaces to manage our packages and code-space. This makes it a requirement to contribute and use this repository.

```sh
# Initiate Yarn in this repository.
yarn
```

We have created a script to create your provider workspace for you so you don't have too much trouble getting started.

```sh
# Follow the prompts carefully using this script.
yarn generate
```

## Creating your provider

Once the generation script has finished you will notice a new directory in the `packages/` folder which will be the same name you passed to the script generation tool. Let's navigate to your provider TypeScript file in `packages/mydb/lib/MyDBProvider.ts`. The file should look like:

```typescript
import { JoshProvider } from '@joshdb/core';

export class MyDBProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {}

export namespace MyDBProvider {
  export interface Options {}
}
```

Now that you are in your provider class' file, you will notice there are many errors regarding certain methods not being defined. The way you will create each method will be using an enum called `Method` exported from `@joshdb/core`.

```typescript
import { Method } from '@joshdb/core';
```

Each method passes a `payload` which has all the information and data for provider to process and modify, which will then be returned back to `Josh`. For a full list of payloads, please reference the [`src/lib/payloads/`](https://github.com/RealShadowNova/joshdb-core/tree/main/src/lib/payloads) directory.

```typescript
import { Payload } from '@joshdb/core';
```

If you need a simpler example of a provider for a better understanding of these types please reference the [`MapProvider`](https://github.com/RealShadowNova/joshdb-core/blob/main/src/lib/structures/defaultProvider/MapProvider.ts).

## Adding options

By default a provider doesn't require any options, but you can actually add your own if your provider requires options like connection urls, a name, etc. To start you will need to add typings for your provider options. To do that we will be using TypeScript namespaces and an interface. We are going to add a `name` option to our provider, this will be a `string`.

```typescript
import { JoshProvider } from '@joshdb/core';

// This is your provider you've been creating.
export class MyProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  // Methods...
}

// Create a namespace which has the same name as your provider class.
export namespace MyProvider {
  // Create an interface called "Options" extending "JoshProvider.Options".
  export interface Options extends JoshProvider.Options {
    // Add your types, in our case "name" with a type of "string".
    name: string;
  }
}
```

Once you have added the typings for your options, let's implement them. By default `JoshProvider`'s constructor adds the options to `this`. So you won't need to set it to `this` manually, but you still can. Below we will add the option `name` to `this`.

```typescript
import { JoshProvider } from '@joshdb/core';

export class MyProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  // Declare the "name" property.
  public name: string;

  // Create the constructor.
  public constructor(options: MyProvider.Options) {
    // Pass the options to the super.
    super(options);

    // Set "name" to "this".
    this.name = options.name;
  }

  // Methods...
}

export namespace MyProvider {
  export interface Options extends JoshProvider.Options {
    name: string;
  }
}
```

If you need to run asynchronous functions when your provider is initiated, then that is made possible in the `init()` method.

```typescript
import { JoshProvider } from '@joshdb/core';

export class MyProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public name: string;

  public constructor(options: MyProvider.Options) {
    super(options);

    this.name = options.name;
  }

  public async init(context: JoshProvider.Context): Promise<JoshProvider.Context> {
    // Run the "init()" method on the super to get other properties set.
    context = await super.init(context);

    // Make asynchronous functions here.

    return context;
  }

  // Methods...
}

export namespace MyProvider {
  export interface Options extends JoshProvider.Options {
    name: string;
  }
}
```

That's it! You have learned everything you need to know to create a provider. Please make sure to reference other providers if you are having trouble referencing these docs.
