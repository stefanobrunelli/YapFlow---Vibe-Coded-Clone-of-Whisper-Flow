import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // Build two entries: the Electron main process and the uiohook utilityProcess child.
    // Both get dropped into out/main/ so main can resolve the child via join(__dirname, 'hookChild.js').
    // rollupOptions is cast because electron-vite's MainBuildOptions type doesn't surface it,
    // though the underlying Vite build config does accept it.
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          hookChild: resolve('src/main/hookChild.ts')
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    build: {
      externalizeDeps: true
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
    // PostCSS is configured via postcss.config.js at the root — Vite picks it up automatically
  }
})
