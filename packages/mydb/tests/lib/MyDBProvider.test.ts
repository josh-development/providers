import { runProviderTest } from '@joshdb/tests';
import { MyDBProvider } from '../../src';

runProviderTest<typeof MyDBProvider, MyDBProvider.Options>({
  providerConstructor: MyDBProvider,
  providerOptions: {}
});
