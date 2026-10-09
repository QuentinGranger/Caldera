import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterCamera, passagePose } from '../src/lib/motion/journey';

test('passages stay bounded during fast scrolling and invalid geometry', () => {
  for (const viewport of [320, 720, 844, 1200]) {
    for (const top of [-100_000, -400, 0, 200, viewport, 100_000, NaN]) {
      const pose = passagePose(top, 310, viewport);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(pose.scale >= 0.55 && pose.scale <= 1.2);
      assert.ok(pose.turn >= -70 && pose.turn <= 70);
      assert.ok(pose.caption >= 0 && pose.caption <= 1);
      assert.ok(pose.thread >= 0 && pose.thread <= 1);
    }
  }
});

test('the same scroll position restores exactly the same scene when reversing', () => {
  const positions = [850, 600, 400, 200, 0, -200, -400];
  const forward = positions.map((top) => passagePose(top, 310, 844));
  const backward = [...positions]
    .reverse()
    .map((top) => passagePose(top, 310, 844));
  assert.deepEqual(backward.reverse(), forward);
});

test('passages have no jump at entry, midpoint or exit', () => {
  for (let top = -320; top <= 730; top++) {
    const before = passagePose(top, 310, 720);
    const after = passagePose(top + 1, 310, 720);
    for (const key of Object.keys(before) as (keyof typeof before)[])
      assert.ok(Math.abs(after[key] - before[key]) < 0.25, `${key} at ${top}`);
  }
});

test('the camera settles to normal size and full opacity while content is read', () => {
  for (const viewport of [320, 720, 844, 1200]) {
    const pose = chapterCamera(0, viewport * 2, viewport);
    assert.deepEqual(pose, { lift: 0, tilt: 0, scale: 1, opacity: 1 });
    for (const top of [-100_000, 0, 100_000, NaN]) {
      const moving = chapterCamera(top, top + viewport * 2, viewport);
      assert.ok(Object.values(moving).every(Number.isFinite));
      assert.ok(moving.opacity >= 0.55 && moving.opacity <= 1);
      assert.ok(moving.scale >= 0.915 && moving.scale <= 1);
    }
  }
});
