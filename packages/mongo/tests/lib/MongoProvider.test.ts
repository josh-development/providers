import { runProviderTest } from '@joshdb/provider';
import { MongoProvider } from '../../src';

runProviderTest<typeof MongoProvider, MongoProvider.Options, MongoProvider>({
  providerConstructor: MongoProvider,
  cleanup: (provider) => provider.close(),
  providerOptions: { collectionName: 'provider' }
});
