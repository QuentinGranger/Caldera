import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  beginNavigation,
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
  let native = false;
  const root = { dataset, style: { setProperty() {}, removeProperty() {} } };
  const fakeDocument = {
    documentElement: root,
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 92 }) }),
    startViewTransition: () => {},
  };
  const values = {
    window: {
      location: {
        origin: 'https://caldera.test',
        href: 'https://caldera.test/',
      },
      matchMedia: () => ({ matches: reduced }),
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
    notePath('/');
  };
  try {
    await t.test('partial API support gets the real entrance', () => {
      prepare();
      beginNavigation('/univers', 'push');
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
  } finally {
    resetPresentation();
    for (const name of names) {
      const descriptor = saved.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
