import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';

// CI runs the suite with react-server; this browser runtime needs client React.
test('Transitions : browser runtime with client React', async () => {
  await promisify(execFile)(process.execPath, [
    '--import',
    'tsx',
    '--test',
    'tests/helpers/transitions-runtime.client.ts',
  ]);
});
