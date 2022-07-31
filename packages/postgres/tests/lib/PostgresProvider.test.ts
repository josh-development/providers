import { runProviderTest } from '@joshdb/provider';
import { PostgresProvider } from '../../src';

runProviderTest<typeof PostgresProvider, PostgresProvider.Options>({
  providerConstructor: PostgresProvider,
  providerOptions: {}
});
