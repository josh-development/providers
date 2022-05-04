import { runProviderTest } from '@joshdb/tests';
import { MongoProvider } from '../../src';

runProviderTest<typeof MongoProvider, MongoProvider.Options, MongoProvider>({
  providerConstructor: MongoProvider,
  cleanup: (provider) => provider.close(),
  providerOptions: { collectionName: 'provider' }
});
