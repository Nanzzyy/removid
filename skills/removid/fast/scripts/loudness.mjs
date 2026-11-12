#!/usr/bin/env node
// Parse the final ebur128 summary, including silence (-inf) and missing values.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const summaries = input.split('Summary:');
const tail = summaries.length > 1 ? summaries.at(-1) : '';
const i = Number(tail.match(/\bI:\s*(-?(?:\d+(?:\.\d+)?|inf))\s+LUFS/)?.[1]);
const peak = Number(tail.match(/Peak:\s*(-?(?:\d+(?:\.\d+)?|inf))\s+dBFS/)?.[1]);
if (!Number.isFinite(i) || !Number.isFinite(peak) || i < -15 || i > -13 || peak > -1.2) {
  console.error(`FAIL loudness: ${i} LUFS / ${peak} dBFS; need -15..-13 LUFS, peak <= -1.2 dBFS`);
  process.exitCode = 1;
} else console.log(`loudness ok: ${i} LUFS / ${peak} dBFS`);
