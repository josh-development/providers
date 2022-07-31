import { JoshProvider } from '@joshdb/provider';

export class PostgreSQLProvider<StoredValue = unknown> extends JoshProvider<StoredValue> {
  public declare options: PostgreSQLProvider.Options;

  public constructor(options: PostgreSQLProvider.Options) {
    super(options);
  }
}

export namespace PostgreSQLProvider {
  export interface Options {}
}
