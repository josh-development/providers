import { createTsupConfig } from '../../scripts/tsup.config';

export default createTsupConfig({ globalName: 'SQLiteProvider', format: ['cjs', 'esm'] });
