import { resolve } from 'node:path';
import { createVitestConfig } from '../../scripts/vitest.config';

export default createVitestConfig({
  test: {
    coverage: {
      reportsDirectory: '../../coverage'
    }
  },
  resolve: { alias: [{ find: '@joshdb/provider/tests', replacement: resolve('../../node_modules/@joshdb/provider/tests') }] }
});
