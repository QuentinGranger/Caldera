import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  beginNavigation,
  finishPresentation,
  notePath,
  presentArrival,
  resetPresentation,
} from '../../src/lib/transitions/runtime';

test('page arrivals remain visible with missing or skipped native captures', async (t) => {
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
    await t.test('partial API support gets a CSS entrance', () => {
      prepare();
      beginNavigation('/univers', 'push');
      presentArrival('/univers');
      assert.equal(dataset.calderaArrival, 'enter-world');
      assert.equal(dataset.calderaMotion, 'fallback');
    });
    await t.test(
      'streaming without a native callback gets the entrance after commit',
      () => {
        prepare();
        beginNavigation('/univers', 'push');
        native = true;
        presentArrival('/univers');
        assert.equal(dataset.calderaMotion, 'native');
        flushFrames();
        assert.equal(dataset.calderaMotion, 'fallback');
      },
    );
    await t.test(
      'native callback wins and releases presentation on completion',
      () => {
        prepare();
        beginNavigation('/univers', 'push');
        native = true;
        presentArrival('/univers');
        const cleanup = finishPresentation();
        flushFrames();
        assert.equal(dataset.calderaMotion, 'native');
        cleanup();
        assert.equal(dataset.calderaArrival, undefined);
        assert.equal(dataset.calderaMotion, undefined);
      },
    );
    await t.test('old cleanup cannot erase a newer navigation', () => {
      prepare();
      beginNavigation('/univers', 'push');
      presentArrival('/univers');
      const oldCleanup = finishPresentation();
      native = false;
      beginNavigation('/univers/origines', 'push');
      presentArrival('/univers/origines');
      oldCleanup();
      assert.equal(dataset.calderaArrival, 'descend');
      assert.equal(dataset.calderaMotion, 'fallback');
    });
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
