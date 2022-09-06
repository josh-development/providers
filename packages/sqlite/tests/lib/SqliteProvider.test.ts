import { runProviderTest } from '@joshdb/provider';
import { SqliteProvider } from '../../src';

runProviderTest<typeof SqliteProvider, Partial<SqliteProvider.Options>>({
  providerConstructor: SqliteProvider,
  providerOptions: {
    persistent: true
  },
  // @ts-expect-error 2322
  cleanup: (provider: SqliteProvider) => {
    provider['handler'].database.close();
  }
});
