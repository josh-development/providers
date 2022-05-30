import { runProviderTest } from '@joshdb/provider';
import { RedisProvider } from '../../src';

runProviderTest<typeof RedisProvider, RedisProvider.Options, RedisProvider>({
  providerConstructor: RedisProvider,
  cleanup: (provider) => provider.close()
});
