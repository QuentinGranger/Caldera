import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  arrivalDuration,
  beginNavigation,
  landscapeTransitions,
  notePath,
  presentArrival,
  resetPresentation,
} from '../../src/lib/transitions/runtime';

test('real scenery is independent of native captures and remains disposable', async (t) => {
  const names = [
    'window',
    'document',
    'CSS',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ] as const;
  const saved = new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const dataset: Record<string, string> = {};
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let reduced = false;
  let mobile = false;
  let native = false;
  let sceneryVisible = false;
  let sceneryBottom = 700;
  const image = {
    complete: true,
    naturalWidth: 1600,
    currentSrc: 'https://caldera.test/previous.webp',
  };
  const scenery = {
    querySelector: () => image,
    getBoundingClientRect: () => ({
      top: sceneryBottom - 608,
      bottom: sceneryBottom,
      left: 0,
      width: 1200,
      height: 608,
    }),
  };
  const root = { dataset, style: { setProperty() {}, removeProperty() {} } };
  const fakeDocument = {
    documentElement: root,
    querySelector: (selector: string) =>
      selector === 'header'
        ? { getBoundingClientRect: () => ({ bottom: 92 }) }
        : sceneryVisible
          ? scenery
          : null,
    startViewTransition: () => {},
  };
  const values = {
    window: {
      innerHeight: 900,
      getComputedStyle: () => ({
        objectPosition: '50% 50%',
        borderRadius: '0px',
        filter: 'none',
      }),
      location: {
        origin: 'https://caldera.test',
        href: 'https://caldera.test/',
      },
      matchMedia: (query: string) => ({
        matches: query.includes('prefers-reduced-motion') ? reduced : mobile,
      }),
    },
    document: fakeDocument,
    CSS: { supports: () => native },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id);
    },
  };
  for (const name of names)
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: values[name],
    });
  const flushFrames = () => {
    while (frames.size) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    }
  };
  const prepare = () => {
    resetPresentation();
    native = false;
    reduced = false;
    mobile = false;
    sceneryVisible = false;
    sceneryBottom = 700;
    image.complete = true;
    image.currentSrc = 'https://caldera.test/previous.webp';
    notePath('/');
  };
  try {
    await t.test('partial API support gets the real entrance', () => {
      prepare();
      beginNavigation('/univers', 'push');
      assert.equal(dataset.calderaMotion, 'departing');
      presentArrival('/univers');
      assert.equal(dataset.calderaArrival, 'enter-world');
      assert.equal(dataset.calderaMotion, 'live');
    });
    await t.test('full API support cannot suppress the real entrance', () => {
      prepare();
      beginNavigation('/univers', 'push');
      native = true;
      presentArrival('/univers');
      assert.equal(dataset.calderaMotion, 'live');
      flushFrames();
      assert.equal(dataset.calderaMotion, 'live');
    });
    await t.test(
      'first visits and repeated commits never replay an entrance',
      () => {
        prepare();
        presentArrival('/');
        assert.equal(dataset.calderaMotion, undefined);
        beginNavigation('/univers', 'push');
        presentArrival('/univers');
        resetPresentation();
        presentArrival('/univers');
        assert.equal(dataset.calderaMotion, undefined);
      },
    );
    await t.test(
      'consecutive same-type journeys select the new destination',
      () => {
        prepare();
        beginNavigation('/univers/origines', 'push');
        presentArrival('/univers/origines');
        beginNavigation('/univers/archives', 'push');
        presentArrival('/univers/archives');
        assert.equal(dataset.calderaArrival, 'chapter-forward');
        assert.equal(dataset.calderaMotion, 'live');
      },
    );
    await t.test(
      'reduced motion, filters, history and utilities skip both effects',
      () => {
        for (const [path, navigation, motion] of [
          ['/univers', 'push', true],
          ['/univers', 'traverse', false],
          ['/?filter=boosters', 'push', false],
          ['/cgv', 'push', false],
        ] as const) {
          prepare();
          reduced = motion;
          beginNavigation(path, navigation);
          presentArrival(new URL(path, 'https://caldera.test').pathname);
          flushFrames();
          assert.equal(dataset.calderaArrival, undefined);
          assert.equal(dataset.calderaMotion, undefined);
        }
      },
    );
    await t.test(
      'mobile uses shorter entrances without changing navigation semantics',
      () => {
        prepare();
        assert.equal(arrivalDuration('shop'), 700);
        assert.equal(arrivalDuration('enter-world'), 900);
        mobile = true;
        assert.equal(arrivalDuration('shop'), 560);
        assert.equal(arrivalDuration('enter-world'), 720);
        beginNavigation('/univers', 'push');
        presentArrival('/univers');
        assert.equal(dataset.calderaArrival, 'enter-world');
      },
    );
    await t.test(
      'a mismatched commit cannot consume the pending arrival',
      () => {
        prepare();
        beginNavigation('/univers', 'push');
        presentArrival('/catalogue');
        assert.equal(dataset.calderaArrival, undefined);
        presentArrival('/univers');
        assert.equal(dataset.calderaArrival, 'enter-world');
      },
    );
    await t.test('a second journey cancels the first entrance cleanup', (t) => {
      prepare();
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
      beginNavigation('/catalogue', 'push');
      presentArrival('/catalogue');
      t.mock.timers.tick(100);
      beginNavigation('/univers', 'push');
      presentArrival('/univers');
      t.mock.timers.tick(221);
      assert.equal(dataset.calderaArrival, 'enter-world');
      assert.equal(dataset.calderaMotion, 'live');
      t.mock.timers.tick(480);
      assert.equal(dataset.calderaMotion, 'live');
      t.mock.timers.tick(200);
      assert.equal(dataset.calderaMotion, undefined);
    });
    await t.test(
      'slow routes release the departure and receive a full entrance at commit',
      (t) => {
        prepare();
        t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
        beginNavigation('/univers', 'push');
        assert.equal(dataset.calderaMotion, 'departing');
        t.mock.timers.tick(241);
        assert.equal(dataset.calderaMotion, undefined);
        t.mock.timers.tick(2000);
        presentArrival('/univers');
        assert.equal(dataset.calderaMotion, 'live');
        t.mock.timers.tick(901);
        assert.equal(dataset.calderaMotion, undefined);
        prepare();
        beginNavigation('/univers', 'push');
        t.mock.timers.tick(350);
        presentArrival('/univers');
        assert.equal(dataset.calderaMotion, 'live');
        t.mock.timers.tick(901);
        assert.equal(dataset.calderaMotion, undefined);
      },
    );
    await t.test(
      'the outgoing landscape survives a slow route and is released',
      (t) => {
        prepare();
        t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
        sceneryVisible = true;
        beginNavigation('/univers', 'push');
        assert.equal(landscapeTransitions.get(), null);
        t.mock.timers.tick(2000);
        image.currentSrc = 'https://caldera.test/destination.webp';
        presentArrival('/univers');
        assert.equal(
          landscapeTransitions.get()?.src,
          'https://caldera.test/previous.webp',
        );
        assert.equal(landscapeTransitions.get()?.top, 92);
        t.mock.timers.tick(901);
        assert.equal(landscapeTransitions.get(), null);
      },
    );
    await t.test(
      'offscreen and unloaded scenery never flashes over the destination',
      () => {
        for (const loaded of [false, true]) {
          prepare();
          sceneryVisible = true;
          image.complete = loaded;
          if (loaded) sceneryBottom = 20;
          beginNavigation('/univers', 'push');
          presentArrival('/univers');
          assert.equal(landscapeTransitions.get(), null);
        }
      },
    );
  } finally {
    resetPresentation();
    for (const name of names) {
      const descriptor = saved.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
