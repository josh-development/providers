import { createVitestConfig } from '../../scripts/vitest.config';

export default createVitestConfig({
  test: {
    coverage: {
      reportsDirectory: '../../coverage'
    }
  }
});
