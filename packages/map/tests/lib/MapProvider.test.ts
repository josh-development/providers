import { runProviderTest } from 'tests';
import { MapProvider } from '../../src';

runProviderTest<typeof MapProvider>({
  providerConstructor: MapProvider,
  serialization: false
});
