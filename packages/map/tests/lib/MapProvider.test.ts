import { runProviderTest } from '@joshdb/provider/tests';
import { MapProvider } from '../../src';

runProviderTest<typeof MapProvider>({
  providerConstructor: MapProvider,
  serialization: false
});
