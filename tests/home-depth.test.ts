import assert from 'node:assert/strict';
import test from 'node:test';
import { depthPoint, observeHomeDepth } from '../src/lib/motion/depth';

test('depth input is neutral at the centre, bounded outside the stage and safe with invalid geometry', () => {
  assert.deepEqual(depthPoint(200, 100, 400, 200), { x: 0, y: 0 });
  assert.deepEqual(depthPoint(-1000, 1000, 400, 200), { x: -1, y: 1 });
  assert.deepEqual(depthPoint(NaN, Infinity, 0, -1), { x: 0, y: 0 });
});

test('depth stops when idle, ignores touch, measures only nearby imagery and cleans up live reduced motion', () => {
  const names = [
    'window',
    'document',
    'innerHeight',
    'IntersectionObserver',
    'ResizeObserver',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ] as const;
  const saved = names.map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  const listeners = new Map<string, (event?: unknown) => void>();
  const reducedListeners = new Set<() => void>();
  const fineListeners = new Set<() => void>();
  const media = (subscriptions: Set<() => void>, matches: boolean) => ({
    matches,
    addEventListener: (_: string, fn: () => void) => subscriptions.add(fn),
    removeEventListener: (_: string, fn: () => void) =>
      subscriptions.delete(fn),
  });
  const reduced = media(reducedListeners, false),
    fine = media(fineListeners, true);
  const styles = new Map<string, string>();
  let reads = 0;
  const node = {
    dataset: {} as Record<string, string>,
    style: {
      setProperty: (k: string, v: string) => styles.set(k, v),
      removeProperty: (k: string) => styles.delete(k),
    },
    getBoundingClientRect() {
      reads++;
      return {
        left: 0,
        top: 200,
        right: 400,
        bottom: 500,
        width: 400,
        height: 300,
      };
    },
  };
  let intersection: (
    entries: { target: typeof node; isIntersecting: boolean }[],
  ) => void = () => {};
  class Observer {
    constructor(fn: typeof intersection) {
      intersection = fn;
    }
    observe() {}
    disconnect() {}
  }
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  const events = {
    addEventListener: (name: string, fn: (event?: unknown) => void) =>
      listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  const fakeWindow = {
    ...events,
    IntersectionObserver: Observer,
    matchMedia: (query: string) =>
      query.includes('reduced-motion') ? reduced : fine,
  };
  const values = {
    window: fakeWindow,
    document: { ...events, hidden: false, querySelectorAll: () => [node] },
    innerHeight: 800,
    IntersectionObserver: Observer,
    ResizeObserver: undefined,
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      frames.set(++id, fn);
      return id;
    },
    cancelAnimationFrame: (key: number) => frames.delete(key),
  };
  const flush = () => {
    const work = [...frames.values()];
    frames.clear();
    work.forEach((fn) => fn(0));
  };
  let cleanup: (() => void) | undefined;
  try {
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: values[name],
      });
    cleanup = observeHomeDepth();
    intersection([{ target: node, isIntersecting: true }]);
    flush();
    assert.equal(frames.size, 0, 'no idle render loop');
    listeners.get('pointermove')!({
      pointerType: 'touch',
      clientX: 400,
      clientY: 200,
    });
    assert.equal(frames.size, 0, 'touch gestures do not drive pointer effects');
    for (let i = 0; i < 10; i++)
      listeners.get('pointermove')!({
        pointerType: 'mouse',
        clientX: 400,
        clientY: 200,
      });
    assert.equal(frames.size, 1, 'pointer events coalesce');
    flush();
    assert.equal(styles.get('--depth-x'), '1.000');
    assert.equal(styles.get('--depth-y'), '-1.000');
    assert.equal(frames.size, 0);
    intersection([{ target: node, isIntersecting: false }]);
    flush();
    const previous = reads;
    listeners.get('scroll')!();
    flush();
    assert.equal(reads, previous, 'offscreen imagery is not measured');
    reduced.matches = true;
    reducedListeners.forEach((fn) => fn());
    assert.equal(node.dataset.depthReady, undefined);
    assert.equal(styles.size, 0);
    assert.equal(listeners.size, 0);
    assert.equal(frames.size, 0);
    reduced.matches = false;
    reducedListeners.forEach((fn) => fn());
    assert.equal(node.dataset.depthReady, '');
    cleanup?.();
    cleanup = undefined;
    assert.equal(listeners.size, 0);
    assert.equal(reducedListeners.size, 0);
    assert.equal(fineListeners.size, 0);
    Reflect.deleteProperty(fakeWindow, 'IntersectionObserver');
    assert.equal(observeHomeDepth(), undefined);
    assert.equal(node.dataset.depthReady, undefined);
  } finally {
    cleanup?.();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
