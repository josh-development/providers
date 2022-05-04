import { JoshProvider } from '@joshdb/core';

export class MyDBProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: MyDBProvider.Options;

  public constructor(options: MyDBProvider.Options) {
    super(options);
  }

  public static version = '[VI]{version}[/VI]';
}

export namespace MyDBProvider {
  export interface Options {}
}
