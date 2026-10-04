import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { getQaTargets, qaBaseUrl } from './qa-targets.mjs';

const ROOT = resolve(process.env.QA_ARTIFACT_ROOT || 'qa-artifacts');
await mkdir(ROOT, { recursive: true });
const targets = await getQaTargets();
const browsers = { chromium, firefox, webkit };
const viewports = [
  { id: 'mobile-portrait', width: 390, height: 844, mobile: true },
  { id: 'desktop', width: 1440, height: 1000, mobile: false },
];
const landscapeTargets = new Set([
  'accueil',
  'categorie',
  'calendrier',
  'panier',
]);
const seoTargets = new Set([
  'accueil',
  'catalogue',
  'pokemon',
  'categorie',
  'extensions',
  'calendrier',
  'produit',
]);
const failures = [];
const checks = [];

function record(message) {
  failures.push(message);
  console.error(`✖ ${message}`);
}

async function inspectPage(browserName, browser, target, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const runtime = [];
  page.on('pageerror', (error) => runtime.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') runtime.push(`console: ${message.text()}`);
  });

  try {
    const response = await page.goto(new URL(target.path, qaBaseUrl).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    if (!response?.ok())
      record(
        `${browserName}/${viewport.id}/${target.id}: HTTP ${response?.status()}`,
      );
    await page
      .locator('main#contenu')
      .waitFor({ state: 'visible', timeout: 10_000 });

    // Next.js can stream route metadata after DOMContentLoaded. Validate the
    // settled DOM rather than treating an early snapshot as final metadata.
    if (seoTargets.has(target.id)) {
      try {
        await page.waitForFunction(
          () =>
            Boolean(
              document
                .querySelector('meta[name="description"]')
                ?.getAttribute('content')
                ?.trim(),
            ),
          undefined,
          { timeout: 5_000 },
        );
      } catch {
        record(
          `${browserName}/${viewport.id}/${target.id}: meta description absente après stabilisation`,
        );
      }
    }

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const h1 = document.querySelector('h1');
      const hero = document.querySelector('[data-frame], [data-home-hero]');
      const arch = document.querySelector('[data-frame="arch"]');
      const archView = arch?.querySelector('[data-hero-view]');
      const interactive = [
        ...document.querySelectorAll('a[href], button, input, select, textarea'),
      ]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            rect.width > 0 &&
            rect.height > 0
          );
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            width: rect.width,
            height: rect.height,
            text: (
              element.getAttribute('aria-label') ||
              element.textContent ||
              ''
            )
              .trim()
              .slice(0, 80),
          };
        });
      return {
        overflow: root.scrollWidth - window.innerWidth,
        h1Visible: Boolean(h1 && h1.getBoundingClientRect().height > 0),
        heroVisible: !hero || hero.getBoundingClientRect().height > 180,
        archVisible:
          !archView ||
          (archView.getBoundingClientRect().width > 100 &&
            archView.getBoundingClientRect().height > 100),
        tinyTargets: interactive
          .filter((item) => item.width < 32 || item.height < 32)
          .slice(0, 10),
        supports: {
          clipPath: CSS.supports('clip-path', 'inset(0)'),
          mask:
            CSS.supports('mask-image', 'linear-gradient(#000,#000)') ||
            CSS.supports('-webkit-mask-image', 'linear-gradient(#000,#000)'),
          sticky: CSS.supports('position', 'sticky'),
          backdrop:
            CSS.supports('backdrop-filter', 'blur(4px)') ||
            CSS.supports('-webkit-backdrop-filter', 'blur(4px)'),
          scrollTimeline: CSS.supports('animation-timeline', 'scroll()'),
          svh: CSS.supports('height', '100svh'),
        },
      };
    });

    if (metrics.overflow > 2)
      record(
        `${browserName}/${viewport.id}/${target.id}: débordement horizontal ${Math.round(metrics.overflow)}px`,
      );
    if (!metrics.h1Visible)
      record(`${browserName}/${viewport.id}/${target.id}: H1 invisible`);
    if (!metrics.heroVisible)
      record(`${browserName}/${viewport.id}/${target.id}: Hero trop petit/invisible`);
    if (!metrics.archVisible)
      record(`${browserName}/${viewport.id}/${target.id}: arche immersive invisible`);
    if (runtime.length)
      record(
        `${browserName}/${viewport.id}/${target.id}: ${runtime.join(' | ')}`,
      );

    if (viewport.mobile && metrics.tinyTargets.length) {
      const problematic = metrics.tinyTargets.filter((item) =>
        ['BUTTON', 'INPUT', 'SELECT'].includes(item.tag),
      );
      if (problematic.length)
        record(
          `${browserName}/${viewport.id}/${target.id}: zones tactiles trop petites: ${JSON.stringify(problematic)}`,
        );
    }

    checks.push({
      browser: browserName,
      viewport: viewport.id,
      target: target.id,
      overflow: metrics.overflow,
      supports: metrics.supports,
    });
    console.log(
      `✔ ${browserName}/${viewport.id}/${target.id}`,
      metrics.supports,
    );
  } catch (error) {
    record(
      `${browserName}/${viewport.id}/${target.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await context.close();
  }
}

async function inspectMobileMenu(browserName, browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto(qaBaseUrl, { waitUntil: 'domcontentloaded' });
    const trigger = page.getByRole('button', { name: 'Ouvrir le menu' });
    await trigger.click();
    const nav = page.getByRole('navigation', { name: 'Navigation mobile' });
    await nav.waitFor({ state: 'visible' });
    const locked = await page.evaluate(
      () => getComputedStyle(document.documentElement).overflow === 'hidden',
    );
    if (!locked)
      record(
        `${browserName}/mobile-menu: le scroll de fond n'est pas verrouillé`,
      );
    await page.getByRole('button', { name: 'Fermer le menu' }).click();
    checks.push({ browser: browserName, scenario: 'mobile-menu', locked });
  } catch (error) {
    record(
      `${browserName}/mobile-menu: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await context.close();
  }
}

async function inspectReducedMotion(browserName, browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await page.goto(new URL('/pokemon/boosters', qaBaseUrl).toString(), {
      waitUntil: 'domcontentloaded',
    });
    const state = await page
      .locator('[data-hero-view] img')
      .first()
      .evaluate((image) => {
        const style = getComputedStyle(image);
        return {
          animationName: style.animationName,
          visibility: style.visibility,
          opacity: style.opacity,
        };
      });
    if (state.animationName !== 'none')
      record(
        `${browserName}/reduced-motion: animation encore active (${state.animationName})`,
      );
    if (state.visibility === 'hidden' || state.opacity === '0')
      record(`${browserName}/reduced-motion: image Hero masquée`);
    checks.push({ browser: browserName, scenario: 'reduced-motion', ...state });
  } catch (error) {
    record(
      `${browserName}/reduced-motion: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await context.close();
  }
}

for (const [browserName, browserType] of Object.entries(browsers)) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      for (const target of targets)
        await inspectPage(browserName, browser, target, viewport);
    }
    for (const target of targets.filter((item) =>
      landscapeTargets.has(item.id),
    )) {
      await inspectPage(browserName, browser, target, {
        id: 'mobile-landscape',
        width: 844,
        height: 390,
        mobile: true,
      });
    }
    await inspectMobileMenu(browserName, browser);
    await inspectReducedMotion(browserName, browser);
  } finally {
    await browser.close();
  }
}

await writeFile(
  resolve(ROOT, 'cross-browser-summary.json'),
  JSON.stringify({ failures, checks }, null, 2),
);

if (failures.length) {
  console.error(`\nQA cross-browser: ${failures.length} anomalie(s).`);
  process.exitCode = 1;
} else {
  console.log('\nQA cross-browser: aucun blocage détecté.');
}
