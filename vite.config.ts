import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// 默认 base 为 '/'；Pages 工作流通过 `--base /metro-chaos/` 只在部署构建时改子路径。
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        crossings: resolve(import.meta.dirname, 'demo/crossings.html'),
        stations: resolve(import.meta.dirname, 'demo/stations.html'),
        trains: resolve(import.meta.dirname, 'demo/trains.html'),
        mutations: resolve(import.meta.dirname, 'demo/mutations.html'),
        labels: resolve(import.meta.dirname, 'demo/labels.html'),
      },
    },
  },
});
