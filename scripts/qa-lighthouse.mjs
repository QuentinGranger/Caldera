import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { getQaTargets, qaBaseUrl } from './qa-targets.mjs';

const OUT = resolve(process.env.QA_ARTIFACT_DIR || 'qa-artifacts/lighthouse');
await mkdir(OUT, { recursive: true });
const lighthouse = resolve('node_modules/.bin/lighthouse');
const chromePath = process.env.LH_CHROME_PATH || process.env.CHROME_PATH;
if (!chromePath) throw new Error('LH_CHROME_PATH/CHROME_PATH manquant');
process.env.CHROME_PATH = chromePath;

const targets = await getQaTargets();
const profiles = [
  { id: 'mobile', args: [] },
  { id: 'desktop', args: ['--preset=desktop'] },
];

const limits = {
  mobile: { performance: 0.65, accessibility: 0.9, bestPractices: 0.9, seo: 0.9, lcp: 5000, cls: 0.15 },
  desktop: { performance: 0.75, accessibility: 0.9, bestPractices: 0.9, seo: 0.9, lcp: 4000, cls: 0.15 },
};

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}`))));
  });
}

function score(report, category) {
  return report.categories?.[category]?.score ?? 0;
}

const failures = [];
const summaries = [];
for (const profile of profiles) {
  for (const target of targets) {
    const out = resolve(OUT, `${target.id}-${profile.id}.json`);
    const url = new URL(target.path, qaBaseUrl).toString();
    await run(lighthouse, [
      url,
      '--quiet',
      '--output=json',
      `--output-path=${out}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--throttling-method=simulate',
      '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
      ...profile.args,
    ]);

    const report = JSON.parse(await readFile(out, 'utf8'));
    const values = {
      performance: score(report, 'performance'),
      accessibility: score(report, 'accessibility'),
      bestPractices: score(report, 'best-practices'),
      seo: score(report, 'seo'),
      lcp: report.audits?.['largest-contentful-paint']?.numericValue ?? Infinity,
      cls: report.audits?.['cumulative-layout-shift']?.numericValue ?? Infinity,
    };
    summaries.push({ target: target.id, profile: profile.id, ...values });
    const threshold = limits[profile.id];
    for (const key of ['performance', 'accessibility', 'bestPractices', 'seo']) {
      if (values[key] < threshold[key]) failures.push(`${target.id}/${profile.id}: ${key}=${values[key].toFixed(2)} < ${threshold[key]}`);
    }
    if (values.lcp > threshold.lcp) failures.push(`${target.id}/${profile.id}: LCP=${Math.round(values.lcp)}ms > ${threshold.lcp}ms`);
    if (values.cls > threshold.cls) failures.push(`${target.id}/${profile.id}: CLS=${values.cls.toFixed(3)} > ${threshold.cls}`);

    const noteworthy = Object.values(report.audits || {})
      .filter((audit) => audit?.score !== null && audit?.score < 0.9 && ['binary','numeric'].includes(audit.scoreDisplayMode || ''))
      .slice(0, 8)
      .map((audit) => `${audit.id}: ${audit.title}`);
    if (noteworthy.length) console.log(`\n[${target.id}/${profile.id}] audits à examiner:\n- ${noteworthy.join('\n- ')}`);
  }
}

console.table(summaries.map((row) => ({
  page: row.target,
  profil: row.profile,
  perf: Math.round(row.performance * 100),
  a11y: Math.round(row.accessibility * 100),
  bp: Math.round(row.bestPractices * 100),
  seo: Math.round(row.seo * 100),
  lcp_ms: Math.round(row.lcp),
  cls: Number(row.cls.toFixed(3)),
})));

if (failures.length) {
  console.error(`\nQA Lighthouse: ${failures.length} seuil(s) non respecté(s):\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
}
