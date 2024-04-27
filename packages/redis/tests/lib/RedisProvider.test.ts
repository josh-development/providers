import { runProviderTest } from 'tests';
import { RedisProvider } from '../../src';

runProviderTest<typeof RedisProvider, RedisProvider.Options, RedisProvider>({
  providerConstructor: RedisProvider,
  // @ts-expect-error 2345
  cleanup: (provider) => provider.close()
});
