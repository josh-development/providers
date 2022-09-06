import { runProviderTest } from '@joshdb/provider';
import { SQLiteProvider } from '../../src';

runProviderTest<typeof SQLiteProvider, Partial<SQLiteProvider.Options>>({
  providerConstructor: SQLiteProvider,
  providerOptions: {
    persistent: false
  },
  // @ts-expect-error 2322
  cleanup: (provider: SQLiteProvider) => {
    provider['handler'].database.close();
  }
});
