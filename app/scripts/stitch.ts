#!/usr/bin/env bun
import { spawn } from 'bun';
import path from 'node:path';

const renderScript = path.resolve(import.meta.dir, 'render.ts');
const proc = spawn([process.execPath, renderScript, 'stitch', ...process.argv.slice(2)], {
  stdio: ['inherit', 'inherit', 'inherit'],
});
const exitCode = await proc.exited;
process.exit(exitCode);
