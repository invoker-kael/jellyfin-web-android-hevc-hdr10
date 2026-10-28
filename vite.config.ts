/// <reference types="vitest" />
/// <reference types="vite/client" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        alias: {
            scripts: fileURLToPath(new URL('./src/scripts', import.meta.url))
        }
    },
    test: {
        coverage: {
            include: [ 'src' ]
        },
        environment: 'jsdom',
        restoreMocks: true
    }
});
