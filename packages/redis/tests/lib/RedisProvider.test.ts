import { runProviderTest } from '@joshdb/tests';
import { RedisProvider } from '../../src';

runProviderTest<typeof RedisProvider, RedisProvider.Options, RedisProvider>({
  cleanup: (provider) => provider.close(),
  providerConstructor: RedisProvider
});
