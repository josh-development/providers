import { runProviderTest } from '../../../../tests/runProviderTest';
import { JSONProvider } from '../../src';

runProviderTest<typeof JSONProvider, JSONProvider.Options>({
  providerConstructor: JSONProvider,
  providerOptions: { dataDirectoryName: '.tests' }
});
