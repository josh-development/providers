import { runProviderTest } from '@joshdb/tests';
import { JSONProvider } from '../../src';

runProviderTest<typeof JSONProvider, JSONProvider.Options>({
  providerConstructor: JSONProvider,
  providerOptions: { dataDirectoryName: '.tests' }
});
