import { JoshProvider } from '@joshdb/provider';

export class PostgresProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: PostgresProvider.Options;

  public constructor(options: PostgresProvider.Options) {
    super(options);
  }
}

export namespace PostgresProvider {
  export interface Options {}
}
