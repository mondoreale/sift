import { expect, test } from '@playwright/test';
import { jobListResponseSchema } from '../src/contracts';

test('serves a healthy same-origin Next.js API', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({
        status: 'ok',
    });
});

test('recovers from an HTTP failure with keyboard retry', async ({ page }) => {
    await page.route('**/api/jobs', (route) =>
        route.fulfill({
            status: 503,
            json: { error: { code: 'INTERNAL_ERROR', message: 'unavailable' } },
        }),
    );
    await page.goto('/');
    await expect(
        page.getByRole('region', { name: 'Job results' }).getByRole('alert'),
    ).toContainText('Could not load jobs');
    await page.unroute('**/api/jobs');
    await page.route('**/api/jobs', (route) =>
        route.fulfill({ json: { items: [], total: 0, availableCountries: [] } }),
    );
    const retry = page.getByRole('button', { name: 'Retry' });
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();
    await expect(page.getByText('0 jobs', { exact: true })).toBeVisible();
});

test('rejects a malformed API response', async ({ page }) => {
    await page.route('**/api/jobs', (route) => route.fulfill({ json: { items: [{}], total: 1 } }));
    await page.goto('/');
    await expect(
        page.getByRole('region', { name: 'Job results' }).getByRole('alert'),
    ).toContainText('Could not load jobs');
});

test('renders long job content without overflow or executable markup', async ({
    page,
}, testInfo) => {
    const title =
        'Senior Platform Engineer for Distributed Infrastructure and Developer Productivity';
    await page.route('**/api/jobs', (route) =>
        route.fulfill({
            json: {
                items: [
                    {
                        id: 'browser-test-job',
                        title,
                        company: 'Example Engineering Company',
                        description:
                            '<img src=x onerror="window.injected=true"> Build reliable systems.',
                        location: { city: 'Montreal', region: 'QC', country: 'CA' },
                        remote: true,
                        compensation: {
                            amount: 65,
                            currency: 'USD',
                            period: 'hourly',
                            annualizedUsd: 135200,
                        },
                        postingDate: null,
                    },
                ],
                total: 1,
                availableCountries: ['CA'],
            },
        }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Date unavailable')).toBeVisible();
    await expect(page.getByText('$65.00')).toBeVisible();
    await expect(page.locator('.description')).toContainText('<img src=x');
    expect(await page.locator('.description img').count()).toBe(0);
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
        path: testInfo.outputPath('populated-board.png'),
        fullPage: true,
    });
});

test('renders the jobs returned by the real API', async ({ page }) => {
    const responsePromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === '/api/jobs' &&
            response.request().method() === 'GET',
    );
    await page.goto('/');
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const jobs = jobListResponseSchema.parse(await response.json());
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
    await expect(page.locator('.result-count')).toHaveText(
        `${jobs.total} ${jobs.total === 1 ? 'job' : 'jobs'}`,
    );
    await expect(page.locator('.job-info h2')).toHaveText(jobs.items.map((job) => job.title));
    if (jobs.total === 0) {
        await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();
    }
});

test('renders an empty approved dataset', async ({ page }) => {
    await page.route('**/api/jobs', (route) =>
        route.fulfill({ json: { items: [], total: 0, availableCountries: [] } }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();
    await expect(page.getByText('0 jobs', { exact: true })).toBeVisible();
});
