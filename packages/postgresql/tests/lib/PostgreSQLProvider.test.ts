import { runProviderTest } from 'tests';
import { PostgreSQLProvider } from '../../src';

runProviderTest<typeof PostgreSQLProvider, PostgreSQLProvider.Options>({
  providerConstructor: PostgreSQLProvider,
  providerOptions: {},
  // @ts-expect-error 2322
  async cleanup(provider: PostgreSQLProvider) {
    await provider['handler'].sql.end();
  }
});
