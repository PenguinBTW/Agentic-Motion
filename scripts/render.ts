#!/usr/bin/env bun
// Forwarder to app/scripts/render.ts
import path from 'node:path';

const target = path.resolve(import.meta.dir, '../app/scripts/render.ts');
const proc = Bun.spawn([process.execPath, target, ...process.argv.slice(2)], {
  cwd: path.resolve(import.meta.dir, '../app'),
  stdio: ['inherit', 'inherit', 'inherit'],
});

const exitCode = await proc.exited;
process.exit(exitCode);
