import { polyfillNode as esbuildPluginPolyfillNode } from 'esbuild-plugin-polyfill-node';
import { createTsupConfig } from '../../scripts/tsup.config';

export default createTsupConfig({
  globalName: 'PostgreSQLProvider',
  esbuildPlugins: [
    esbuildPluginPolyfillNode({
      polyfills: { crypto: true }
    })
  ]
});
