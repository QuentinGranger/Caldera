import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterFlow, itemReveal } from '../src/lib/motion/journey';

test('real visuals settle before reaching the upper reading area', () => {
  for (const viewport of [320, 720, 844, 1200]) {
    assert.equal(itemReveal(viewport, viewport), 0);
    assert.equal(itemReveal(viewport * 0.25, viewport), 1);
    assert.equal(itemReveal(0, viewport), 1);
    for (const top of [-100_000, 0, 100_000, NaN]) {
      const reveal = itemReveal(top, viewport);
      assert.ok(Number.isFinite(reveal) && reveal >= 0 && reveal <= 1);
    }
  }
});

test('content handoffs are reversible and continuous without extra scroll distance', () => {
  const positions = [850, 600, 400, 200, 0, -200, -400];
  const forward = positions.map((top) => chapterFlow(top, 1500, 844));
  const backward = [...positions]
    .reverse()
    .map((top) => chapterFlow(top, 1500, 844));
  assert.deepEqual(backward.reverse(), forward);
  for (let top = -1600; top < 850; top++) {
    const before = chapterFlow(top, 1500, 844);
    const after = chapterFlow(top + 1, 1500, 844);
    for (const key of Object.keys(before) as (keyof typeof before)[])
      assert.ok(Math.abs(after[key] - before[key]) < 0.003);
    assert.ok(
      Math.abs(itemReveal(top, 844) - itemReveal(top + 1, 844)) < 0.003,
    );
  }
});

test('the 3D card handoff preserves the original pose throughout its pinned chapter', () => {
  for (const viewport of [720, 844, 1200]) {
    for (let top = 0; top >= -viewport * 2; top -= 10) {
      const flow = chapterFlow(top, viewport * 3, viewport);
      assert.equal(flow.arrival, 1);
      assert.equal(flow.departure, 0);
    }
    assert.equal(chapterFlow(viewport, viewport * 3, viewport).arrival, 0);
    assert.equal(
      chapterFlow(-viewport * 3, viewport * 3, viewport).departure,
      1,
    );
  }
  for (const value of [NaN, Infinity, 0, -1])
    assert.deepEqual(chapterFlow(0, value, 844), {
      progress: 0,
      arrival: 1,
      departure: 0,
    });
});
