# Writing your provider for Josh

This page will guide you through the development process of creating your provider.

## Prerequisites

You should have already read the previous [Getting Started](GettingStarted.md) page. If you haven't read it please go back and do so.

## Creating your provider

First, before we create any files let's create a sub-directory in `src/` called `lib` using the following command.

```sh
mkdir lib
```

Now in this directory create the file for your provider. Here we are going to call the provider `MyProvider`, so replace `My` with your provider name (e.g. `MongoProvider`). Here we can use the exported `JoshProvider` class from `@joshdb/core`.

### `src/lib/MyProvider.ts`

```typescript
// Import the JoshProvider class.
import { JoshProvider } from '@joshdb/core';

// Create your provider class.
export class MyProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {}
```

Now that you have created your provider, you will notice there are many errors regarding certain methods not being declared. The way you will create each method will be using an enum called `Method` exported from `@joshdb/core`.

```typescript
import { Method } from '@joshdb/core';
```

Each method will passes a `payload` which has all the information for your provider to execute and modify and return back to `Josh`. For a full list of payloads, please reference the [`src/lib/payloads/`](https://github.com/RealShadowNova/joshdb-core/tree/main/src/lib/payloads) directory.

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

## Previously - [Getting Started](GettingStarted.md)

## References

- [`src/lib/payloads/`](https://github.com/RealShadowNova/joshdb-core/tree/main/src/lib/payloads)
- [`MapProvider`](https://github.com/RealShadowNova/joshdb-core/blob/main/src/lib/structures/defaultProvider/MapProvider.ts)
