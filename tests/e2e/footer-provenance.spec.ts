import { expect, test } from '@playwright/test';

test('footer exposes build metadata and the public source link', async ({
  page,
}) => {
  await page.goto('/');

  const source = page.getByTestId('footer-provenance-source');
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute(
    'href',
    'https://github.com/bradsaucier/opsnormal',
  );
  await expect(source).toHaveAttribute('target', '_blank');
  const rel = (await source.getAttribute('rel')) ?? '';
  expect(rel).toContain('noopener');
  expect(rel).toContain('noreferrer');

  const provenance = page.getByTestId('footer-provenance');
  await expect(provenance).toContainText('MIT');
  await expect(provenance.getByText(/^v\d/)).toBeVisible();
  await expect(
    page.getByText('OpsNormal is a personal status tracking tool.'),
  ).toBeVisible();
});
