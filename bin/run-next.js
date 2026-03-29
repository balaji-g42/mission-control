#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (!value) return '';

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const unwrapped = value.slice(1, -1);
    return value.startsWith('"') ? unwrapped.replace(/\\n/g, '\n') : unwrapped;
  }

  return value;
}

function loadEnvFile(filePath, initialKeys, loadedKeys) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separatorIndex = withoutExport.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = withoutExport.slice(0, separatorIndex).trim();
    if (!key) continue;

    const rawValue = withoutExport.slice(separatorIndex + 1);
    const value = parseEnvValue(rawValue);

    const keyExistsInitially = initialKeys.has(key);
    const keyWasLoadedByScript = loadedKeys.has(key);

    if (!keyExistsInitially || keyWasLoadedByScript) {
      process.env[key] = value;
      loadedKeys.add(key);
    }
  }
}

function loadEnvFiles(cwd) {
  const initialKeys = new Set(Object.keys(process.env));
  const loadedKeys = new Set();

  // Later files should override earlier ones, matching common .env usage.
  loadEnvFile(path.join(cwd, '.env'), initialKeys, loadedKeys);
  loadEnvFile(path.join(cwd, '.env.local'), initialKeys, loadedKeys);
}

function run() {
  const cwd = process.cwd();
  loadEnvFiles(cwd);

  const mode = process.argv[2] || 'dev';
  const extraArgs = process.argv.slice(3);
  const port = process.env.PORT || '4000';

  const nextBin = require.resolve('next/dist/bin/next');
  const args = [nextBin, mode, ...extraArgs, '-p', port];

  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    cwd,
    env: process.env
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error('Failed to start Next.js:', err.message);
    process.exit(1);
  });
}

run();
