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
    }
  ],
  external: [
    '@joshdb/serialize',
    'fs',
    'fs/promises',
    'path',
    'timers/promises',
    '@joshdb/core',
    '@realware/utilities',
    '@sapphire/utilities',
    '@sapphire/async-queue',
    '@sapphire/snowflake'
  ],
  plugins: [cleaner({ targets: ['./dist'] }), typescript({ tsconfig: resolve(process.cwd(), 'src', 'tsconfig.json') }), versionInjector()]
};
