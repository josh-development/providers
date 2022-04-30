import { runProviderTest } from '@joshdb/tests';
import { JSONProvider } from '../../src';

// @ts-expect-error 2344
runProviderTest<typeof JSONProvider, JSONProvider.Options>({
  providerConstructor: JSONProvider,
  providerOptions: { dataDirectoryName: '.tests' }
});
