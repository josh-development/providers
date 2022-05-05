import { runProviderTest } from '@joshdb/tests';
import { MapProvider } from '../../src';

runProviderTest<typeof MapProvider>({
  providerConstructor: MapProvider
});
