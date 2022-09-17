import type { ESBuildOptions } from 'vite';
import { defineConfig, UserConfig } from 'vitest/config';

export const createVitestConfig = (options: UserConfig = {}) =>
  defineConfig({
    ...options,
    test: {
      ...options?.test,
      deps: {
        inline: true
      },
      globals: true,
      coverage: {
        ...options.test?.coverage,
        enabled: true,
        reporter: ['text', 'lcov', 'clover'],
        exclude: [...(options.test?.coverage?.exclude ?? []), '**/node_modules/**', '**/dist/**', '**/tests/**']
      }
    },
    esbuild: {
      ...options?.esbuild,
      target: (options?.esbuild as ESBuildOptions | undefined)?.target ?? 'es2021'
    }
  });
