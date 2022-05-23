import { runProviderTest } from '@joshdb/provider';
import { JSONProvider } from '../../src';

runProviderTest<typeof JSONProvider, JSONProvider.Options>({
  providerConstructor: JSONProvider,
  providerOptions: { dataDirectoryName: '.tests' }
});
