import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.js so the Cloudflare/React plugins do not load for unit tests.
export default defineConfig({
  test: {
    include: [
      'src/**/*.test.{js,jsx,ts}',
      'scripts/**/*.test.{js,mjs}',
      'supabase/functions/_shared/**/*.test.ts',
    ],
    environment: 'node',
    passWithNoTests: true,
  },
})
