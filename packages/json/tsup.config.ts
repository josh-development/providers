import { createTsupConfig } from '../../scripts/tsup.config';

export default createTsupConfig({
  globalName: 'JSONProvider',
  format: ['cjs', 'esm']
});
