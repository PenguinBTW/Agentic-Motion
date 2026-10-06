#!/usr/bin/env bun
// Canonical entry is bun scripts/<tool>.ts (root, cwd=app). This shim exists for bun app/scripts/<tool>.ts direct use.
import { spawn } from 'bun';
import path from 'node:path';

const renderScript = path.resolve(import.meta.dir, 'render.ts');
const proc = spawn([process.execPath, renderScript, 'godview', ...process.argv.slice(2)], {
  stdio: ['inherit', 'inherit', 'inherit'],
});
const exitCode = await proc.exited;
process.exit(exitCode);

