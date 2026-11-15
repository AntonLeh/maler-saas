import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import seoPrerender from './seoPrerender'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoPrerender()],
  // manifest: damit die vorab gerenderten Seiten ihre CSS-Datei bekommen (wird nach dem Build wieder gelöscht)
  build: { manifest: true },
})
