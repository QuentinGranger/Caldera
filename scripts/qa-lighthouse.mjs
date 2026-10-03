import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const outDir = process.env.QA_OUTPUT_DIR ?? 'qa-results';
const routes = [
  ['home', '/'],
  ['catalogue', '/catalogue'],
  ['pokemon', '/pokemon'],
  ['boosters', '/pokemon/boosters'],
  ['scelles', '/pokemon/scelles'],
  ['extensions', '/extensions'],
  ['calendar', '/calendrier-des-sorties'],
  ['product', '/produit/dev-etb-terres-de-braise'],
  ['cart', '/panier'],
];

await mkdir(outDir, { recursive: true });

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

for (const [name, path] of routes) {
  for (const mode of ['mobile', 'desktop']) {
    const output = `${outDir}/lighthouse-${name}-${mode}.json`;
    const args = [
      `${base}${path}`,
      '--quiet',
      '--output=json',
      `--output-path=${output}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless --no-sandbox --disable-gpu',
    ];
    if (mode === 'desktop') args.push('--preset=desktop');
    await run('lighthouse', args);
  }
}

const rows = [];
const findings = [];
for (const [name, path] of routes) {
  for (const mode of ['mobile', 'desktop']) {
    const report = JSON.parse(
      await readFile(`${outDir}/lighthouse-${name}-${mode}.json`, 'utf8'),
    );
    const score = (key) => Math.round((report.categories[key]?.score ?? 0) * 100);
    const metric = (key) => report.audits[key]?.numericValue ?? null;
    rows.push({
      page: name,
      path,
      mode,
      performance: score('performance'),
      accessibility: score('accessibility'),
      bestPractices: score('best-practices'),
      seo: score('seo'),
      lcpMs: Math.round(metric('largest-contentful-paint') ?? 0),
      cls: Number((metric('cumulative-layout-shift') ?? 0).toFixed(3)),
      tbtMs: Math.round(metric('total-blocking-time') ?? 0),
    });

    for (const audit of Object.values(report.audits)) {
      if (
        audit?.score !== null &&
        audit?.score !== undefined &&
        audit.score < 0.9 &&
        !['manual', 'notApplicable', 'informative'].includes(audit.scoreDisplayMode)
      ) {
        findings.push({
          page: name,
          mode,
          id: audit.id,
          score: Math.round(audit.score * 100),
          title: audit.title,
          value: audit.displayValue ?? '',
        });
      }
    }
  }
}

console.log('\nLIGHTHOUSE QA SUMMARY');
console.table(rows);
console.log('\nLOW-SCORING AUDITS (< 90)');
for (const finding of findings.slice(0, 120)) {
  console.log(
    `[${finding.page}/${finding.mode}] ${finding.id} ${finding.score} — ${finding.title}${finding.value ? ` — ${finding.value}` : ''}`,
  );
}

const severe = rows.filter(
  (row) =>
    row.accessibility < 90 ||
    row.bestPractices < 90 ||
    row.seo < 90 ||
    (row.mode === 'mobile' && row.performance < 60) ||
    (row.mode === 'desktop' && row.performance < 75) ||
    row.cls > 0.25,
);

if (severe.length) {
  console.error('\nQA thresholds failed:');
  console.table(severe);
  process.exitCode = 1;
}
