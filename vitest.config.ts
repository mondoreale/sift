import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    oxc: { jsx: { runtime: 'automatic' } },
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'server',
                    environment: 'node',
                    include: ['src/server/**/*.test.ts', 'src/contracts/**/*.test.ts'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'client',
                    environment: 'jsdom',
                    include: ['src/client/**/*.test.ts', 'src/client/**/*.test.tsx'],
                    setupFiles: ['./src/client/test/setup.ts'],
                },
            },
        ],
    },
});
