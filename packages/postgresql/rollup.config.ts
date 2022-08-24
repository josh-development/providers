import { resolve } from 'path';
import cleaner from 'rollup-plugin-cleaner';
import typescript from 'rollup-plugin-typescript2';
import versionInjector from 'rollup-plugin-version-injector';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: './dist/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    {
      file: './dist/index.mjs',
      format: 'es',
      exports: 'named',
      sourcemap: true
    },
    {
      file: './dist/index.umd.js',
      format: 'umd',
      name: 'JoshPostgreSQLProvider',
      exports: 'named',
      sourcemap: true,
      globals: {
        '@joshdb/provider': 'JoshProvider',
        '@joshdb/serialize': 'JoshSerialize',
        '@sapphire/snowflake': 'SapphireSnowflake',
        '@sapphire/utilities': 'SapphireUtilities',
        postgres: 'Postgres',
        'property-helpers': 'PropertyHelpers'
      }
    }
  ],
  external: ['@joshdb/provider', '@joshdb/serialize', '@sapphire/snowflake', '@sapphire/utilities', 'postgres', 'property-helpers'],
  plugins: [cleaner({ targets: ['./dist'] }), typescript({ tsconfig: resolve(process.cwd(), 'src', 'tsconfig.json') }), versionInjector()]
};