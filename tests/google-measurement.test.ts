import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { CONSENT_KEY } from '../src/lib/analytics/client';
import { startGoogleMeasurement } from '../src/lib/analytics/google';

test('GTM container: consent required, automatic collection disabled, no private fields', () => {
  const { containerVersion: container } = JSON.parse(
    readFileSync(
      new URL('../docs/gtm-container.json', import.meta.url),
      'utf8',
    ),
  );
  for (const tag of container.tag) {
    assert.equal(tag.consentSettings.consentStatus, 'NEEDED');
    assert.deepEqual(tag.consentSettings.consentType.list, [
      { type: 'TEMPLATE', value: 'analytics_storage' },
    ]);
    assert.ok(
      ['dest_ga', 'gaawe'].includes(tag.type),
      'Only native Google Analytics tags',
    );
  }
  for (const setting of container.gtagConfig)
    for (const parameter of setting.parameter)
      if (parameter.type === 'BOOLEAN') assert.equal(parameter.value, 'false');
  for (const variable of container.variable) {
    assert.equal(variable.type, 'v', 'No custom JavaScript variable');
    const name = variable.parameter.find(
      (parameter: { key: string }) => parameter.key === 'name',
    ).value;
    assert.match(
      name,
      /^caldera_(event_name|parameters\.(page_location|page_title|page_referrer|items|currency|value|transaction_id|shipping|tax))$/,
    );
  }
});

function browser() {
  const keys = ['window', 'document', 'location', 'localStorage'] as const;
  const previous = keys.map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const storage = new Map<string, string>();
  const scripts: { id: string; src: string; nonce: string }[] = [];
  const window: { dataLayer?: unknown[]; [key: string]: unknown } = {};
  const globals = {
    window,
    location: { origin: 'https://lesterresdecaldera.fr' },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
    },
    document: {
      getElementById: (id: string) =>
        scripts.find((script) => script.id === id),
      createElement: () => ({}),
      head: {
        appendChild: (script: (typeof scripts)[number]) => scripts.push(script),
      },
    },
  };
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: globals[key],
    });
  return {
    scripts,
    window,
    storage,
    consent(accepted: boolean) {
      storage.set(
        CONSENT_KEY,
        JSON.stringify({ accepted, expires: Date.now() + 60000 }),
      );
    },
    commands() {
      return (window.dataLayer ?? [])
        .filter(
          (item) =>
            Object.prototype.toString.call(item) === '[object Arguments]',
        )
        .map((item) => Array.from(item as IArguments));
    },
    restore() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('Google: no loading or data layer without valid consent and IDs', () => {
  const ui = browser();
  try {
    const options = { measurementId: 'G-TEST123', containerId: 'GTM-TEST123' };
    assert.equal(startGoogleMeasurement(options), undefined);
    ui.consent(false);
    assert.equal(startGoogleMeasurement(options), undefined);
    ui.consent(true);
    assert.equal(
      startGoogleMeasurement({ ...options, containerId: 'invalid' }),
      undefined,
    );
    assert.equal(
      startGoogleMeasurement({ ...options, measurementId: 'invalid' }),
      undefined,
    );
    assert.equal(ui.scripts.length, 0);
    assert.equal(ui.window.dataLayer, undefined);
  } finally {
    ui.restore();
  }
});

test('GTM: one loader, consent first, isolated event payloads, withdrawal and reacceptance', () => {
  const ui = browser();
  try {
    ui.consent(true);
    const options = {
      measurementId: 'G-TEST123',
      containerId: 'GTM-TEST123',
      nonce: 'test-csp-nonce',
    };
    const first = startGoogleMeasurement(options)!;
    assert.equal(ui.scripts.length, 1);
    assert.equal(
      ui.scripts[0]?.src,
      'https://www.googletagmanager.com/gtm.js?id=GTM-TEST123',
    );
    assert.equal(ui.scripts[0]?.nonce, 'test-csp-nonce');
    const commands = ui.commands();
    assert.equal(commands[0]?.[0], 'consent');
    assert.equal(commands[0]?.[1], 'default');
    assert.equal(
      (commands[0]?.[2] as Record<string, string>).analytics_storage,
      'denied',
    );
    assert.equal(
      (commands[1]?.[2] as Record<string, string>).analytics_storage,
      'granted',
    );
    assert.equal(
      (commands[1]?.[2] as Record<string, string>).ad_storage,
      'denied',
    );
    assert.equal(
      commands.some((command) => command[0] === 'config'),
      false,
      'Only GTM initialises GA4',
    );
    first.send('purchase', {
      transaction_id: 'order_1',
      items: [{ item_id: 'a' }],
      value: 12,
    });
    first.send('page_view', {
      page_location: 'https://lesterresdecaldera.fr/catalogue',
    });
    const update = ui.commands().find((command) => command[0] === 'config');
    assert.equal((update?.[2] as Record<string, unknown>).update, true);
    assert.equal(
      (update?.[2] as Record<string, unknown>).send_page_view,
      false,
    );
    const updates = ui
      .commands()
      .filter((command) => command[0] === 'config').length;
    first.send('add_to_cart', {
      page_location: 'https://lesterresdecaldera.fr/catalogue',
    });
    assert.equal(
      ui.commands().filter((command) => command[0] === 'config').length,
      updates,
      'Repeated actions on a page do not initialise another context',
    );
    first.send('page_view', {
      page_location: 'https://lesterresdecaldera.fr/catalogue',
    });
    assert.deepEqual(ui.window.dataLayer?.slice(-2), [
      { caldera_parameters: null },
      {
        event: 'caldera_measurement',
        caldera_event_name: 'page_view',
        caldera_parameters: {
          page_location: 'https://lesterresdecaldera.fr/catalogue',
        },
      },
    ]);
    ui.consent(false);
    first.stop();
    assert.equal(ui.window['ga-disable-G-TEST123'], true);
    assert.equal(
      (ui.commands().at(-1)?.[2] as Record<string, string>).analytics_storage,
      'denied',
    );
    const length = ui.window.dataLayer!.length;
    first.send('page_view', {});
    assert.equal(ui.window.dataLayer!.length, length);
    ui.consent(true);
    const second = startGoogleMeasurement(options)!;
    assert.equal(
      ui.scripts.length,
      1,
      'Reaccepting does not load the container twice',
    );
    assert.equal(
      ui.window.dataLayer!.filter(
        (item) => (item as { event?: string }).event === 'gtm.js',
      ).length,
      1,
    );
    assert.equal(ui.window['ga-disable-G-TEST123'], false);
    second.send('page_view', {});
    assert.equal(
      (ui.window.dataLayer!.at(-1) as { caldera_event_name: string })
        .caldera_event_name,
      'page_view',
    );
    second.stop();
  } finally {
    ui.restore();
  }
});

test('Google: direct GA4 remains operational until a published GTM ID is configured', () => {
  const ui = browser();
  try {
    ui.consent(true);
    const google = startGoogleMeasurement({ measurementId: 'G-TEST123' })!;
    assert.equal(
      ui.scripts[0]?.src,
      'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
    );
    const config = ui.commands().find((command) => command[0] === 'config');
    assert.equal(
      (config?.[2] as Record<string, unknown>).send_page_view,
      false,
    );
    google.send('page_view', { page_title: 'Caldera' });
    assert.deepEqual(ui.commands().at(-1), [
      'event',
      'page_view',
      { page_title: 'Caldera', send_to: 'G-TEST123' },
    ]);
    google.stop();
  } finally {
    ui.restore();
  }
});
