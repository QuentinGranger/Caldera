import { test, expect } from '@playwright/test';

const ROUTES = [
  '/',
  '/catalogue',
  '/pokemon',
  '/pokemon/boosters',
  '/pokemon/scelles',
  '/extensions',
  '/calendrier-des-sorties',
  '/produit/dev-etb-terres-de-braise',
  '/panier',
];

const HERO_ROUTES = new Set([
  '/',
  '/catalogue',
  '/pokemon',
  '/pokemon/boosters',
  '/pokemon/scelles',
  '/calendrier-des-sorties',
]);

function isMobileProject(name) {
  return name.includes('android') || name.includes('ios') || name.includes('landscape');
}

for (const route of ROUTES) {
  test(`${route} : rendu stable, sans erreur ni débordement`, async ({ page }, testInfo) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response, route).not.toBeNull();
    expect(response.status(), route).toBeLessThan(400);

    await expect(page.locator('main#contenu')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();

    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      bodyScroll: document.body.scrollWidth,
    }));
    expect(
      Math.max(geometry.scroll, geometry.bodyScroll),
      `${route} horizontal overflow on ${testInfo.project.name}`,
    ).toBeLessThanOrEqual(geometry.viewport + 2);

    if (HERO_ROUTES.has(route)) {
      const hero = route === '/'
        ? page.locator('[data-home-hero]')
        : page.locator('section[aria-labelledby="page-title"]');
      await expect(hero).toBeVisible();
      const box = await hero.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThan(250);
      await expect(hero.locator('h1')).toBeVisible();
    }

    expect(pageErrors, `${route} page errors`).toEqual([]);
    expect(
      consoleErrors.filter(
        (message) =>
          !/vercel\/insights|favicon|Failed to load resource.*404/i.test(message),
      ),
      `${route} console errors`,
    ).toEqual([]);
  });
}

test('header sticky, menu mobile et panier restent utilisables', async ({ page }, testInfo) => {
  await page.goto('/catalogue', { waitUntil: 'networkidle' });

  const header = page.locator('header').first();
  await expect(header).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(150);
  const headerBox = await header.boundingBox();
  expect(headerBox?.y ?? 999).toBeLessThanOrEqual(2);

  if (isMobileProject(testInfo.project.name)) {
    const menu = page.getByRole('button', { name: /Ouvrir le menu/i });
    await menu.click();
    const navigation = page.getByRole('navigation', { name: 'Navigation mobile' });
    await expect(navigation).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Ouvrir le menu/i })).toBeVisible();
  }

  const cart = page.getByRole('button', { name: /Ouvrir le panier/i });
  await cart.click();
  const drawer = page.locator('#caldera-cart-drawer');
  await expect(drawer).toHaveAttribute('open', '');
  const box = await drawer.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width ?? 0).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  expect(box?.height ?? 0).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
  await page.keyboard.press('Escape');
});

test('arche dorée : le cadrage reste présent sur les moteurs desktop', async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Arche desktop uniquement');
  await page.goto('/pokemon', { waitUntil: 'networkidle' });
  const hero = page.locator('section[data-frame="arch"]');
  await expect(hero).toBeVisible();

  const values = await hero.evaluate((section) => {
    const images = section.querySelectorAll('img');
    const viewImage = images[images.length - 1];
    const view = viewImage?.parentElement;
    if (!view) return null;
    const style = getComputedStyle(view);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      radius: style.borderTopLeftRadius,
      width: view.getBoundingClientRect().width,
      height: view.getBoundingClientRect().height,
    };
  });
  expect(values).not.toBeNull();
  expect(values.width).toBeGreaterThan(250);
  expect(values.height).toBeGreaterThan(values.width);
  expect(values.outlineStyle).not.toBe('none');
  expect(values.outlineWidth).not.toBe('0px');
  expect(values.radius).not.toBe('0px');
});

test('prefers-reduced-motion désactive les mouvements décoratifs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'networkidle' });
  const image = page.locator('[data-home-hero] img').first();
  await expect(image).toBeVisible();
  expect(await image.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');

  await page.goto('/pokemon/boosters', { waitUntil: 'networkidle' });
  const heroImage = page.locator('section[aria-labelledby="page-title"] img').last();
  await expect(heroImage).toBeVisible();
  expect(await heroImage.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
});
