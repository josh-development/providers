import { runProviderTest } from '@joshdb/provider';
import { PostgreSQLProvider } from '../../src';

runProviderTest<typeof PostgreSQLProvider, PostgreSQLProvider.Options>({
  providerConstructor: PostgreSQLProvider,
  providerOptions: {}
});
