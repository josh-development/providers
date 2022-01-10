import { runProviderTest } from '../../../../tests/runProviderTest';
import { MongoProvider, MongoProviderError } from '../../src';

runProviderTest<typeof MongoProvider, MongoProvider.Options, MongoProvider>({
	providerConstructor: MongoProvider,
	errorConstructor: MongoProviderError,
	cleanup: (provider) => provider.close(),
	providerOptions: { collectionName: 'provider' }
});
