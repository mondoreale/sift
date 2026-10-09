import { expect, test } from '@playwright/test';
import { jobListResponseSchema } from '../src/contracts';

test('serves a healthy same-origin Next.js API', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({
        status: 'ok',
    });
});

test('recovers from an HTTP failure with keyboard retry', async ({ page }, testInfo) => {
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
    await page.screenshot({ path: testInfo.outputPath('error-board.png'), fullPage: true });
    await page.unroute('**/api/jobs');
    await page.route('**/api/jobs', (route) =>
        route.fulfill({ json: { items: [], total: 0, availableCountries: [] } }),
    );
    const retry = page.getByRole('button', { name: 'Retry' });
    await retry.focus();
    await expect(retry).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();
    await expect(page.locator('header > p')).toHaveText(/0\s*jobs available/);
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
                            '<img src=x onerror="window.injected=true"> Build reliable systems.\n' +
                            'UnbrokenContent'.repeat(30),
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
    await expect(page.getByText('$65 / hr')).toBeVisible();
    const results = page.getByRole('region', { name: 'Job results' });
    await expect(results.getByText('<img src=x', { exact: false })).toBeVisible();
    await expect(results.getByRole('listitem').locator('img')).toHaveCount(0);
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
        path: testInfo.outputPath('populated-board.png'),
        fullPage: true,
    });

    for (const width of [280, 390, 640, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const headingBounds = (await page
            .getByRole('heading', { name: 'Open positions' })
            .boundingBox())!;
        const countBounds = (await page.locator('header > p').boundingBox())!;
        expect(
            headingBounds.x + headingBounds.width <= countBounds.x ||
                headingBounds.y + headingBounds.height <= countBounds.y,
        ).toBe(true);
        const search = page.getByRole('searchbox', { name: 'Search titles' });
        const country = page.getByRole('combobox', { name: 'Country' });
        const sort = page.getByRole('combobox', { name: 'Sort' });

        for (const control of [search, country, sort]) {
            await expect(control).toBeVisible();
            const bounds = await control.boundingBox();
            expect(bounds?.height).toBeGreaterThanOrEqual(44);
            expect(bounds?.x).toBeGreaterThanOrEqual(0);
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        }

        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.screenshot({
            path: testInfo.outputPath(`responsive-${width}.png`),
            fullPage: true,
        });
    }
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
    await expect(page.getByRole('heading', { name: 'Open positions', exact: true })).toBeVisible();
    await expect(page.locator('header > p')).toHaveText(
        new RegExp(`${jobs.total}\\s*${jobs.total === 1 ? 'job' : 'jobs'} available`),
    );
    await expect(
        page
            .getByRole('region', { name: 'Job results' })
            .getByRole('listitem')
            .getByRole('heading'),
    ).toHaveText(jobs.items.map((job) => job.title));
    if (jobs.total === 0) {
        await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();
    }
});

test('renders an empty approved dataset', async ({ page }, testInfo) => {
    await page.route('**/api/jobs', (route) =>
        route.fulfill({ json: { items: [], total: 0, availableCountries: [] } }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();
    await expect(page.locator('header > p')).toHaveText(/0\s*jobs available/);
    await page.screenshot({ path: testInfo.outputPath('empty-board.png'), fullPage: true });
});

test('keeps loading visible with reduced motion and supports keyboard navigation', async ({
    page,
}, testInfo) => {
    let releaseResponse!: () => void;
    await page.route('**/api/jobs**', async (route) => {
        await new Promise<void>((resolve) => {
            releaseResponse = resolve;
        });
        await route.fulfill({ json: { items: [], total: 0, availableCountries: [] } });
    });
    await page.goto('/');
    const results = page.getByRole('region', { name: 'Job results' });
    const status = results.getByRole('status');
    await expect(results).toHaveAttribute('aria-busy', 'true');
    await expect(status).toContainText('Loading jobs...');
    await expect(status).toContainText('Fetching the latest open positions.');
    await page.screenshot({ path: testInfo.outputPath('loading-board.png'), fullPage: true });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(status).toBeVisible();
    await page.keyboard.press('Tab');
    const search = page.getByRole('searchbox', { name: 'Search titles' });
    await expect(search).toBeFocused();
    await page.keyboard.press('Tab');
    const country = page.getByRole('combobox', { name: 'Country' });
    await expect(country).toBeFocused();
    await page.keyboard.press('Tab');
    const sort = page.getByRole('combobox', { name: 'Sort' });
    await expect(sort).toBeFocused();

    releaseResponse();
    await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();
    await expect(results).toHaveAttribute('aria-busy', 'false');
});

test('searches, filters, sorts and clears through the redesigned controls', async ({
    page,
}, testInfo) => {
    const queries: Record<string, string>[] = [];
    await page.route('**/api/jobs**', (route) => {
        queries.push(Object.fromEntries(new URL(route.request().url()).searchParams));
        return route.fulfill({
            json: { items: [], total: 0, availableCountries: ['CA', 'US'] },
        });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search titles' }).fill('Engineer');
    await expect.poll(() => queries.at(-1)).toMatchObject({ search: 'Engineer' });
    await expect(page.getByRole('heading', { name: 'No matching jobs' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Country' }).selectOption('CA');
    await expect.poll(() => queries.at(-1)).toMatchObject({ search: 'Engineer', country: 'CA' });
    await page.getByRole('combobox', { name: 'Sort' }).selectOption('salary:asc');
    await expect
        .poll(() => queries.at(-1))
        .toMatchObject({
            search: 'Engineer',
            country: 'CA',
            sortBy: 'salary',
            sortOrder: 'asc',
        });
    const clear = page.getByRole('button', { name: 'Clear filters' });
    await expect(clear).toBeVisible();
    await page.screenshot({
        path: testInfo.outputPath('filtered-empty-board.png'),
        fullPage: true,
    });

    await clear.focus();
    await expect(clear).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'No jobs available' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search titles' })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Country' })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Sort' })).toHaveValue('date:desc');
    expect(queries.at(-1)).toEqual({});
});
