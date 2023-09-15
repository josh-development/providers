import { esbuildPluginVersionInjector } from 'esbuild-plugin-version-injector';
import { relative, resolve } from 'node:path';
import { defineConfig, type Options } from 'tsup';

export const createTsupConfig = (options: Options = {}) =>
  defineConfig({
    clean: true,
    dts: true,
    entry: ['src/index.ts'],
    format: ['cjs', 'esm', 'iife'],
    minify: false,
    skipNodeModulesBundle: true,
    sourcemap: true,
    target: 'es2021',
    tsconfig: relative(__dirname, resolve(process.cwd(), 'src', 'tsconfig.json')),
    keepNames: true,
    esbuildPlugins: [esbuildPluginVersionInjector(), ...(options.esbuildPlugins ?? [])],
    treeshake: true,
    ...options
  });
