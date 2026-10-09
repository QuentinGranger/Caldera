import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cardStoryPose,
  cardStoryProgress,
} from '../src/lib/three/card-story-motion';

test('3D story: pinned scroll maps safely to start/end, with a reversible clock', () => {
  assert.equal(cardStoryProgress(0, 2448, 720), 0);
  assert.equal(cardStoryProgress(-864, 2448, 720), 0.5);
  assert.equal(cardStoryProgress(-1728, 2448, 720), 1);
  assert.equal(cardStoryProgress(800, 2448, 720), 0);
  assert.equal(cardStoryProgress(-9999, 2448, 720), 1);
  assert.equal(cardStoryProgress(NaN, 0, 0), 0);
  for (const p of [0, 0.28, 0.53, 0.76, 1]) {
    assert.deepEqual(
      cardStoryPose(cardStoryProgress(-1728 * p, 2448, 720)),
      cardStoryPose(p),
    );
  }
});

test('3D story: front, macro, back and fan are distinct; poses stay continuous at chapter boundaries', () => {
  assert.equal(cardStoryPose(0).chapter, 0);
  assert.equal(cardStoryPose(0.53).chapter, 1);
  assert.equal(cardStoryPose(1).chapter, 2);
  assert.ok(Math.cos(cardStoryPose(0).ry) > 0.8);
  assert.ok(cardStoryPose(0.28).scale > 1.5);
  assert.ok(Math.cos(cardStoryPose(0.53).ry) < -0.9);
  assert.ok(Math.cos(cardStoryPose(1).ry) > 0.9);
  assert.equal(cardStoryPose(0.53).fan, 0);
  assert.equal(cardStoryPose(0.76).fan, 1);
  let previous = cardStoryPose(0);
  for (let i = 0; i <= 1000; i++) {
    const current = cardStoryPose(i / 1000);
    assert.ok(Object.values(current).every(Number.isFinite));
    assert.ok(Math.abs(current.ry - previous.ry) < 0.03, 'no snapped rotation');
    assert.ok(current.scale >= 0.87 && current.scale <= 1.55);
    assert.ok(current.fan >= 0 && current.fan <= 1);
    previous = current;
  }
  assert.deepEqual(cardStoryPose(NaN), cardStoryPose(0));
  assert.deepEqual(cardStoryPose(-1), cardStoryPose(0));
  assert.deepEqual(cardStoryPose(2), cardStoryPose(1));
});
