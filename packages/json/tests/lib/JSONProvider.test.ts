import { runProviderTest } from '@joshdb/provider';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSONProvider } from '../../src';

mkdirSync(resolve(process.cwd(), '.tests', 'provider'), { recursive: true });

runProviderTest<typeof JSONProvider, JSONProvider.Options>({
  providerConstructor: JSONProvider,
  providerOptions: { dataDirectoryName: '.tests', disableSerialization: true }
});
