import { expect, test } from '@playwright/test';

// DESIGN.md › Material and Accessibility: glass falls back to solid with reduced
// transparency, gains a rim with more contrast; reduced motion drops transitions;
// every focus state is visible.

const glassNav = (page: import('@playwright/test').Page) => page.locator('.glass-nav').first();

test('reduced transparency turns glass solid', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await page.goto('/');
  const style = await glassNav(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { blur: cs.backdropFilter, bg: cs.backgroundColor };
  });
  expect(style.blur).toBe('none');
  expect(style.bg).toBe('rgb(255, 255, 255)');
});

test('more contrast turns glass solid with a rim', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' });
  await page.goto('/');
  const style = await glassNav(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { blur: cs.backdropFilter, shadow: cs.boxShadow };
  });
  expect(style.blur).toBe('none');
  expect(style.shadow).toContain('1.5px');
});

test('reduced motion removes press and roll transitions', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/login');
  const press = await page.getByRole('button', { name: 'Send code' }).evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(press).toBe('0s');
  await ctx.close();
});

test('keyboard focus is always visible', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Phone number').focus();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: cs.outlineWidth, tag: el.tagName };
  });
  expect(outline).toEqual({ style: 'solid', width: '2px', tag: 'BUTTON' });
});
