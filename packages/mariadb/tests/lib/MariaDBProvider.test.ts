import { runProviderTest } from '@joshdb/provider';
import { MariaDBProvider } from '../../src';

runProviderTest<typeof MariaDBProvider, MariaDBProvider.Options, MariaDBProvider>({
  providerConstructor: MariaDBProvider,
  providerOptions: {},
  cleanup: (provider) => provider.close()
});
