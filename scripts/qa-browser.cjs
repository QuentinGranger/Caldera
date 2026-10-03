const assert = require('node:assert/strict');
const { chromium, firefox, webkit } = require('playwright');

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3001';

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

const matrix = [
  {
    name: 'chromium-desktop',
    type: chromium,
    context: { viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'firefox-desktop',
    type: firefox,
    context: { viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'webkit-desktop',
    type: webkit,
    context: { viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'chromium-android',
    type: chromium,
    context: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
    },
  },
  {
    name: 'webkit-ios',
    type: webkit,
    context: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
  },
  {
    name: 'chromium-landscape',
    type: chromium,
    context: {
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
  {
    name: 'webkit-landscape',
    type: webkit,
    context: {
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isMobile(name) {
  return /android|ios|landscape/.test(name);
}

async function goto(page, path) {
  const response = await page.goto(baseURL + path, {
    waitUntil: 'load',
    timeout: 25_000,
  });
  assert.ok(response, path + ': no response');
  assert.ok(response.status() < 400, path + ': HTTP ' + response.status());
  await sleep(300);
}

async function checkRoute(context, project, path) {
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await goto(page, path);

  const main = page.locator('main#contenu:not([aria-busy="true"])').last();
  assert.ok(await main.isVisible(), path + ': main not visible');
  const h1 = page.locator('h1').first();
  assert.ok(await h1.isVisible(), path + ': h1 not visible');

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    rootScroll: document.documentElement.scrollWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  const overflow = Math.max(geometry.rootScroll, geometry.bodyScroll);
  if (overflow > geometry.viewport + 2) {
    const offenders = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      return [...document.querySelectorAll('body *')]
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName.toLowerCase(),
            className: typeof node.className === 'string' ? node.className : '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          };
        })
        .filter((item) => item.right > viewport + 2 || item.left < -2)
        .sort((a, b) => Math.max(b.right - viewport, -b.left) - Math.max(a.right - viewport, -a.left))
        .slice(0, 12);
    });
    assert.fail(
      `${path}: horizontal overflow ${overflow} > ${geometry.viewport}; offenders=${JSON.stringify(offenders)}`,
    );
  }

  if (HERO_ROUTES.has(path)) {
    const hero = path === '/'
      ? page.locator('[data-home-hero]')
      : page.locator('section[aria-labelledby="page-title"]');
    assert.ok(await hero.isVisible(), path + ': hero not visible');
    const box = await hero.boundingBox();
    assert.ok((box?.height || 0) > 250, path + ': hero too short');
    assert.ok(await hero.locator('h1').isVisible(), path + ': hero title hidden');
  }

  assert.deepEqual(pageErrors, [], path + ': page errors');
  const actionableConsole = consoleErrors.filter(
    (message) =>
      !/_vercel\/speed-insights\/script\.js|favicon|Failed to load resource.*404/i.test(message),
  );
  assert.deepEqual(actionableConsole, [], path + ': console errors');

  await page.close();
  console.log(`[PASS] ${project} ${path}`);
}

async function checkInteractions(context, project) {
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  await goto(page, '/catalogue');

  const header = page.locator('header').first();
  assert.ok(await header.isVisible(), project + ': header hidden');
  await page.evaluate(() => window.scrollTo(0, 700));
  await sleep(150);
  const headerBox = await header.boundingBox();
  assert.ok((headerBox?.y ?? 999) <= 2, project + ': sticky header detached');

  if (isMobile(project)) {
    const menu = page.getByRole('button', { name: /Ouvrir le menu/i });
    await menu.click();
    const nav = page.getByRole('navigation', { name: 'Navigation mobile' });
    assert.ok(await nav.isVisible(), project + ': mobile nav hidden after open');
    assert.equal(
      await page.evaluate(() => document.documentElement.style.overflow),
      'hidden',
      project + ': document scroll not locked',
    );
    await page.keyboard.press('Escape');
    assert.ok(
      await page.getByRole('button', { name: /Ouvrir le menu/i }).isVisible(),
      project + ': mobile menu did not close',
    );
  }

  const cart = page.getByRole('button', { name: /Ouvrir le panier/i });
  await cart.click();
  const drawer = page.locator('#caldera-cart-drawer');
  assert.ok(await drawer.getAttribute('open') !== null, project + ': cart drawer not open');
  const box = await drawer.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(
    (box?.width || 0) <= (viewport?.width || 0) + 1,
    project + ': cart drawer wider than viewport',
  );
  assert.ok(
    (box?.height || 0) <= (viewport?.height || 0) + 1,
    project + ': cart drawer taller than viewport',
  );
  await page.keyboard.press('Escape');
  await page.close();
  console.log(`[PASS] ${project} interactions`);
}

async function checkArch(context, project) {
  if (isMobile(project)) return;
  const page = await context.newPage();
  await goto(page, '/pokemon');
  const hero = page.locator('section[data-frame="arch"]');
  assert.ok(await hero.isVisible(), project + ': arch hero hidden');

  const values = await hero.evaluate((section) => {
    const images = section.querySelectorAll('img');
    const viewImage = images[images.length - 1];
    const view = viewImage?.parentElement;
    if (!view) return null;
    const style = getComputedStyle(view);
    const rect = view.getBoundingClientRect();
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      radius: style.borderTopLeftRadius,
      width: rect.width,
      height: rect.height,
    };
  });

  assert.ok(values, project + ': arch view missing');
  assert.ok(values.width > 250, project + ': arch too narrow');
  assert.ok(values.height > values.width, project + ': arch aspect ratio broken');
  assert.notEqual(values.outlineStyle, 'none', project + ': gold outline missing');
  assert.notEqual(values.outlineWidth, '0px', project + ': gold outline zero');
  assert.notEqual(values.radius, '0px', project + ': arch radius missing');
  await page.close();
  console.log(`[PASS] ${project} arch`);
}

async function checkReducedMotion(browserType, project) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await goto(page, '/');
    const homeImage = page.locator('[data-home-hero] img').first();
    assert.ok(await homeImage.isVisible(), project + ': home hero image hidden');
    assert.equal(
      await homeImage.evaluate((node) => getComputedStyle(node).animationName),
      'none',
      project + ': home animation still active with reduced motion',
    );

    await goto(page, '/pokemon/boosters');
    const pageHeroImage = page.locator('section[aria-labelledby="page-title"] img').last();
    assert.ok(await pageHeroImage.isVisible(), project + ': page hero image hidden');
    assert.equal(
      await pageHeroImage.evaluate((node) => getComputedStyle(node).animationName),
      'none',
      project + ': page hero animation still active with reduced motion',
    );

    await context.close();
    console.log(`[PASS] ${project} reduced-motion`);
  } finally {
    await browser.close();
  }
}

(async () => {
  let failures = 0;

  for (const entry of matrix) {
    const browser = await entry.type.launch({ headless: true });
    try {
      const context = await browser.newContext(entry.context);
      for (const route of ROUTES) {
        try {
          await checkRoute(context, entry.name, route);
        } catch (error) {
          failures += 1;
          console.error(`[FAIL] ${entry.name} ${route}\n${error.stack || error}`);
        }
      }

      try {
        await checkInteractions(context, entry.name);
      } catch (error) {
        failures += 1;
        console.error(`[FAIL] ${entry.name} interactions\n${error.stack || error}`);
      }

      try {
        await checkArch(context, entry.name);
      } catch (error) {
        failures += 1;
        console.error(`[FAIL] ${entry.name} arch\n${error.stack || error}`);
      }

      await context.close();
    } finally {
      await browser.close();
    }
  }

  for (const entry of [
    { name: 'chromium', type: chromium },
    { name: 'firefox', type: firefox },
    { name: 'webkit', type: webkit },
  ]) {
    try {
      await checkReducedMotion(entry.type, entry.name);
    } catch (error) {
      failures += 1;
      console.error(`[FAIL] ${entry.name} reduced-motion\n${error.stack || error}`);
    }
  }

  if (failures) {
    console.error(`\nCross-browser QA: ${failures} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('\nCross-browser QA: all checks passed.');
  }
})();
