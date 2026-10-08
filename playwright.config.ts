import { defineConfig, devices } from '@playwright/test';

const built = process.env.TEST_BUILT === '1';
const baseURL = 'http://127.0.0.1:3100';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    reporter: 'list',
    use: { baseURL, trace: 'retain-on-failure' },
    projects: [
        {
            name: 'desktop',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: 'mobile',
            use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
        },
    ],
    webServer: {
        command: built ? 'pnpm run start --port 3100' : 'pnpm run dev --port 3100',
        url: `${baseURL}/api/health`,
        reuseExistingServer: false,
        timeout: 60000,
    },
});
