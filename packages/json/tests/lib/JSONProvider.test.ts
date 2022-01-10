import { runProviderTest } from '../../../../tests/runProviderTest';
import { JSONProvider, JSONProviderError } from '../../src';

runProviderTest<typeof JSONProvider, JSONProvider.Options>({
	providerConstructor: JSONProvider,
	errorConstructor: JSONProviderError,
	providerOptions: { dataDirectoryName: '.tests' }
});
