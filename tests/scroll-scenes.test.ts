import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  sceneProgress,
  sceneBeats,
  storyBlend,
  storyPosition,
} from '../src/lib/motion/scene';
import { observeScrollScenes } from '../src/lib/motion/observer';

test('scroll scenes: bounded geometry, continuous landscape handoffs and readable word holds', () => {
  assert.equal(sceneProgress(0, 1600, 800, true), 0);
  assert.equal(sceneProgress(-400, 1600, 800, true), 0.5);
  assert.equal(sceneProgress(-800, 1600, 800, true), 1);
  assert.equal(sceneProgress(800, 500, 800, false), 0);
  assert.equal(sceneProgress(-500, 500, 800, false), 1);
  assert.equal(sceneProgress(0, 800, 800, true), 0.5);
  assert.equal(sceneProgress(NaN, 800, 800, true), 0);
  assert.equal(sceneProgress(0, 0, 800, true), 0);
  assert.equal(storyBlend(0), 0);
  assert.equal(storyBlend(1), 1);
  assert.equal(storyPosition(0), 0);
  assert.equal(storyPosition(1), 3);
  for (let step = -10; step <= 110; step++) {
    const weights = sceneBeats(step / 100, 5);
    assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-10);
    assert.ok(weights.every((weight) => weight >= 0 && weight <= 1));
    assert.ok(weights.filter((weight) => weight > 0).length <= 2);
    assert.ok(storyPosition(step / 100) >= 0 && storyPosition(step / 100) <= 3);
  }
});

test('scroll observer: static fallback, active-only geometry, coalescing and live preference cleanup', () => {
  const globals = [
    'window',
    'document',
    'IntersectionObserver',
    'ResizeObserver',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ] as const;
  const saved = globals.map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  const listeners = new Map<string, () => void>();
  const reducedListeners = new Set<() => void>();
  const wideListeners = new Set<() => void>();
  const media = (subscriptions: Set<() => void>, matches: boolean) => ({
    matches,
    addEventListener: (_: string, fn: () => void) => subscriptions.add(fn),
    removeEventListener: (_: string, fn: () => void) =>
      subscriptions.delete(fn),
  });
  const reduced = media(reducedListeners, false);
  const wide = media(wideListeners, true);
  const makeScene = (kind: string, top: number, height: number) => {
    const styles = new Map<string, string>();
    return {
      dataset: { scrollScene: kind } as Record<string, string>,
      styles,
      top,
      height,
      reads: 0,
      style: {
        setProperty: (name: string, value: string) => styles.set(name, value),
        removeProperty: (name: string) => styles.delete(name),
      },
      getBoundingClientRect() {
        this.reads++;
        return { top: this.top, height: this.height };
      },
    };
  };
  const hero = makeScene('hero', 0, 1600);
  const origins = makeScene('origins', 4000, 800);
  let intersection: (
    entries: { target: typeof hero; isIntersecting: boolean }[],
  ) => void = () => {};
  let disconnected = 0;
  class FakeObserver {
    constructor(callback: typeof intersection) {
      intersection = callback;
    }
    observe() {}
    disconnect() {
      disconnected++;
    }
  }
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const events = {
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  const fakeWindow = {
    ...events,
    innerHeight: 800,
    IntersectionObserver: FakeObserver,
    matchMedia: (query: string) =>
      query.includes('reduced-motion') ? reduced : wide,
  };
  const values = {
    window: fakeWindow,
    document: {
      ...events,
      hidden: false,
      querySelectorAll: () => [hero, origins],
    },
    IntersectionObserver: FakeObserver,
    ResizeObserver: undefined,
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      frames.set(++nextFrame, fn);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  let cleanup: (() => void) | undefined;
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn(0));
  };
  try {
    for (const name of globals)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: values[name],
      });
    cleanup = observeScrollScenes();
    assert.equal(hero.dataset.sceneReady, '');
    assert.equal(hero.styles.get('--scene-progress'), '0.0000');
    assert.equal(hero.styles.get('--story-position'), '0.0000');
    const originsReads = origins.reads;
    intersection([
      { target: hero, isIntersecting: true },
      { target: origins, isIntersecting: false },
    ]);
    hero.top = -400;
    for (let i = 0; i < 10; i++) listeners.get('scroll')!();
    assert.equal(frames.size, 1);
    flush();
    assert.equal(hero.styles.get('--scene-progress'), '0.5000');
    assert.equal(
      origins.reads,
      originsReads,
      'offscreen scenes have no per-frame geometry reads',
    );
    reduced.matches = true;
    reducedListeners.forEach((fn) => fn());
    assert.equal(hero.dataset.sceneReady, undefined);
    assert.equal(hero.styles.size, 0);
    assert.equal(listeners.size, 0);
    assert.equal(frames.size, 0);
    assert.equal(disconnected, 1);
    reduced.matches = false;
    reducedListeners.forEach((fn) => fn());
    assert.equal(hero.dataset.sceneReady, '');
    cleanup?.();
    cleanup = undefined;
    assert.equal(listeners.size, 0);
    assert.equal(reducedListeners.size, 0);
    assert.equal(wideListeners.size, 0);
    assert.equal(hero.styles.size, 0);
    // Missing API: nothing is hidden and no listeners are installed.
    Reflect.deleteProperty(fakeWindow, 'IntersectionObserver');
    assert.equal(observeScrollScenes(), undefined);
    assert.equal(hero.dataset.sceneReady, undefined);
    assert.equal(listeners.size, 0);
  } finally {
    cleanup?.();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
