// Proves report.schema.json / error.schema.json are valid JSON Schema and
// actually enforce the contract: fixtures must pass, and known-bad mutations
// must fail. Run via `npm run validate-schema` (shared workspace).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const reportSchema = readJson(path.join(dir, '../src/report.schema.json'));
const errorSchema = readJson(path.join(dir, '../src/error.schema.json'));
const validReport = readJson(path.join(dir, '../fixtures/report.valid.json'));
const validError = readJson(path.join(dir, '../fixtures/error.valid.json'));

const ajv = new Ajv2020({ strict: true, allErrors: true });
const validateReport = ajv.compile(reportSchema);
const validateError = ajv.compile(errorSchema);

let failures = 0;

function expect(name, ok) {
  if (ok) {
    console.log(`  ok — ${name}`);
  } else {
    failures++;
    console.error(`  FAIL — ${name}`);
  }
}

console.log('report.schema.json');
expect('valid fixture passes', validateReport(validReport));
expect('unknown observation key rejected', !validateReport({ ...validReport, observations: [{ ...validReport.observations[0], key: 'not_a_real_key' }] }));
expect('missing required field rejected', !validateReport({ ...validReport, scores: undefined }));
expect('additional top-level property rejected', !validateReport({ ...validReport, unexpected: true }));
expect('wrong version rejected', !validateReport({ ...validReport, version: 2 }));

console.log('error.schema.json');
expect('valid fixture passes', validateError(validError));
expect('unknown stage rejected', !validateError({ ...validError, error: { ...validError.error, stage: 'bogus' } }));
expect('missing message rejected', !validateError({ ...validError, error: { stage: 'pose' } }));

if (failures > 0) {
  console.error(`\n${failures} schema check(s) failed`);
  process.exit(1);
}
console.log('\nAll schema checks passed');
