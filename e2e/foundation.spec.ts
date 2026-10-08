import { expect, test } from '@playwright/test';

test('serves only approved demo jobs through the same-origin Next.js API', async ({
    page,
    request,
}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    expect(await (await request.get('/api/health')).json()).toEqual({
        status: 'ok',
    });
    const response = await (await request.get('/api/jobs')).json();
    expect(response.total).toBe(8);
    expect(response.availableCountries).toEqual(['CA', 'DE', 'GB', 'US']);
    expect(
        response.items.every((job: { company: string | null }) => job.company?.startsWith('Demo:')),
    ).toBe(true);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Platform Engineer' })).toBeVisible();
    await expect(page.getByText('8 jobs', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans"'))).toBe(true);
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
        path: testInfo.outputPath('demo-board.png'),
        fullPage: true,
    });
    expect(errors).toEqual([]);
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
    const retry = page.getByRole('button', { name: 'Retry' });
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Platform Engineer' })).toBeVisible();
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

test('searches titles, filters countries and resets no matches through the Next.js API', async ({
    page,
}, testInfo) => {
    await page.goto('/');
    await expect(page.getByText('8 jobs', { exact: true })).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Search titles' });
    await search.focus();
    await page.keyboard.type('eNgInEeR');
    await expect(page.getByText('6 jobs', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Country' }).selectOption('CA');
    await expect(page.getByText('2 jobs', { exact: true })).toBeVisible();
    await expect(page.locator('.job-info h2')).toHaveText(['Data Engineer', 'Security Engineer']);
    await search.fill('no such title');
    await expect(page.getByRole('heading', { name: 'No matching jobs' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'United Kingdom' })).toBeAttached();
    await page.screenshot({
        path: testInfo.outputPath('no-matches.png'),
        fullPage: true,
    });
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('8 jobs', { exact: true })).toBeVisible();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Country' })).toHaveValue('');
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
});

test('sorts all four ways with comparable pay and unknown dates last', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('8 jobs', { exact: true })).toBeVisible();
    const sorts: [string, string[]][] = [
        [
            'salary:asc',
            [
                'Software Engineer',
                'Data Engineer',
                'Remote Systems Engineer',
                'Cloud Engineer',
                'Product Analyst',
                'UX Designer',
                'Security Engineer',
                'Platform Engineer',
            ],
        ],
        [
            'salary:desc',
            [
                'Platform Engineer',
                'Security Engineer',
                'Product Analyst',
                'UX Designer',
                'Cloud Engineer',
                'Remote Systems Engineer',
                'Data Engineer',
                'Software Engineer',
            ],
        ],
        [
            'date:asc',
            [
                'Product Analyst',
                'UX Designer',
                'Data Engineer',
                'Cloud Engineer',
                'Remote Systems Engineer',
                'Platform Engineer',
                'Software Engineer',
                'Security Engineer',
            ],
        ],
        [
            'date:desc',
            [
                'Platform Engineer',
                'Remote Systems Engineer',
                'Cloud Engineer',
                'Data Engineer',
                'Product Analyst',
                'UX Designer',
                'Software Engineer',
                'Security Engineer',
            ],
        ],
    ];
    for (const [value, titles] of sorts) {
        await page.getByRole('combobox', { name: 'Sort' }).selectOption(value);
        await expect(page.locator('.job-info h2')).toHaveText(titles);
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
