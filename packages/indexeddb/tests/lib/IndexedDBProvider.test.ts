import { runProviderTest } from '@joshdb/provider/tests';
import 'fake-indexeddb/auto';
import { IndexedDBProvider } from '../../src';

runProviderTest<typeof IndexedDBProvider, IndexedDBProvider.Options>({
  providerConstructor: IndexedDBProvider,
  providerOptions: {}
});
