import { mkdir, writeFile } from 'node:fs/promises';
import { generateDraft } from './model.mjs';
import { evaluationJob, cases } from './evaluation-cases.mjs';

if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is required');
const results = [];
for (const item of cases) {
  try {
    const output = await generateDraft({ job: evaluationJob, sourceText: item.sourceText }, process.env);
    const pass = item.check(output);
    results.push({ id: item.id, sourceText: item.sourceText, expected: item.expected, pass, output });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${item.id}: ${output.metrics.generationMs}ms`);
  } catch (error) {
    results.push({ id: item.id, sourceText: item.sourceText, expected: item.expected, pass: false, error: error.message });
    console.log(`FAIL ${item.id}: ${error.message}`);
  }
}
const path = new URL('../evaluations/', import.meta.url); await mkdir(path, { recursive: true });
const report = { runAt: new Date().toISOString(), model: process.env.DEEPSEEK_MODEL || 'deepseek-flash', total: results.length, passed: results.filter(r => r.pass).length, scope: '10 synthetic feedback cases; not production accuracy or time saved', results };
await writeFile(new URL('2026-11-04-live.json', path), JSON.stringify(report, null, 2) + '\n');
console.log(`Result: ${report.passed}/${report.total}`);
if (report.passed !== report.total) process.exitCode = 1;
