import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { test } from 'node:test';

// CI runs the suite with react-server; this browser runtime needs client React.
test('Transitions : browser runtime with client React', async () => {
  const env = { ...process.env };
  // Do not inherit Node's test-child marker: it would skip the nested runner.
  delete env.NODE_TEST_CONTEXT;
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      '--import',
      'tsx',
      '--test',
      '--test-reporter=tap',
      'tests/helpers/transitions-runtime.client.ts',
    ],
    { env },
  );
  assert.match(stdout, /# tests 7\b/);
  assert.match(stdout, /# fail 0\b/);
});
