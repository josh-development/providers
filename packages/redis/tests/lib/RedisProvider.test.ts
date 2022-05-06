import { runProviderTest } from '@joshdb/tests';
import { RedisProvider } from '../../src';

runProviderTest<typeof RedisProvider, RedisProvider.Options, RedisProvider>({
  providerConstructor: RedisProvider,
    cleanup: (provider) => provider.close()
});
