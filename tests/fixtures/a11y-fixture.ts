import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';

type AxeFixture = {
  makeAxeBuilder: () => AxeBuilder;
};

export const test = base.extend<AxeFixture>({
  makeAxeBuilder: async ({ page }, provideBuilder) => {
    await provideBuilder(() =>
      new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
      ]),
    );
  },
});

export { expect };
