import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gsap } from 'gsap';
import { observeAureval } from '../src/lib/motion/aureval';

test('Aureval pauses outside the viewport and in hidden tabs, and releases motion on preference change and unmount', (t) => {
  const keys = [
    'window',
    'document',
    'innerHeight',
    'matchMedia',
    'IntersectionObserver',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ] as const;
  const saved = keys.map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const mobile = Object.assign(new EventTarget(), { matches: false });
  const fine = Object.assign(new EventTarget(), { matches: true });
  const section = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({
      top: 100,
      left: 0,
      width: 1200,
      height: 600,
    }),
  });
  const planes = [{}, {}];
  const root = {
    dataset: {} as Record<string, string>,
    closest: () => section,
    querySelector: (selector: string) =>
      selector.includes('far') ? planes[0] : planes[1],
    querySelectorAll: () => [],
  };
  let onIntersection: (
    entries: { isIntersecting: boolean }[],
  ) => void = () => {};
  let disconnects = 0,
    reverts = 0,
    contexts = 0;
  class Observer {
    constructor(callback: typeof onIntersection) {
      onIntersection = callback;
    }
    observe() {}
    disconnect() {
      disconnects++;
    }
  }
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const document = Object.assign(new EventTarget(), { hidden: false });
  const window = Object.assign(new EventTarget(), {
    IntersectionObserver: Observer,
  });
  const values = {
    window,
    document,
    innerHeight: 800,
    matchMedia: (query: string) =>
      query.includes('reduced-motion')
        ? reduced
        : query.includes('max-width')
          ? mobile
          : fine,
    IntersectionObserver: Observer,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id);
    },
  };
  const paused: boolean[] = [];
  t.mock.method(gsap, 'timeline', (options: { paused: boolean }) => {
    assert.equal(options.paused, true);
    return {
      paused: (value: boolean) => paused.push(value),
    } as unknown as gsap.core.Timeline;
  });
  t.mock.method(gsap, 'context', (callback: () => void) => {
    contexts++;
    callback();
    return {
      revert: () => {
        reverts++;
      },
    } as unknown as gsap.Context;
  });
  t.mock.method(
    gsap,
    'quickTo',
    () => (() => {}) as unknown as ReturnType<typeof gsap.quickTo>,
  );
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: values[key],
    });
  let cleanup: (() => void) | undefined;
  try {
    cleanup = observeAureval(root as unknown as HTMLElement);
    assert.equal(root.dataset.aurevalMotion, 'paused');
    assert.equal(frames.size, 0, 'No scroll frame while offscreen');
    onIntersection([{ isIntersecting: true }]);
    assert.equal(root.dataset.aurevalMotion, 'running');
    assert.equal(paused.at(-1), false);
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(paused.at(-1), true);
    assert.equal(
      frames.size,
      0,
      'Pending scroll frame is cancelled when hidden',
    );
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(paused.at(-1), false);
    onIntersection([{ isIntersecting: false }]);
    assert.equal(root.dataset.aurevalMotion, 'paused');
    assert.equal(paused.at(-1), true);
    assert.equal(frames.size, 0, 'Pending scroll frame is cancelled offscreen');
    reduced.matches = true;
    reduced.dispatchEvent(new Event('change'));
    assert.equal(root.dataset.aurevalMotion, 'still');
    assert.equal(reverts, 1);
    assert.equal(frames.size, 0);
    reduced.matches = false;
    reduced.dispatchEvent(new Event('change'));
    assert.equal(contexts, 2);
    assert.equal(reverts, 1, 'Old renderer is disposed once');
    cleanup?.();
    cleanup = undefined;
    assert.equal(disconnects, 2);
    assert.equal(reverts, 2);
    assert.equal(root.dataset.aurevalMotion, undefined);
    reduced.dispatchEvent(new Event('change'));
    window.dispatchEvent(new Event('scroll'));
    assert.equal(contexts, 2, 'Preference listener is removed on unmount');
    assert.equal(frames.size, 0);
  } finally {
    cleanup?.();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
