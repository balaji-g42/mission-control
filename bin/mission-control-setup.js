#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (q) => new Promise(resolve => rl.question(q, resolve));

async function setup() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║       Mission Control Setup Wizard        ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');

  const installDir = path.dirname(__dirname);
  const envPath = path.join(installDir, '.env');

  // Check if .env exists
  if (fs.existsSync(envPath)) {
    const overwrite = await question('  ⚠️  .env already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('  Skipping .env creation.');
    } else {
      await createEnvFile(envPath);
    }
  } else {
    await createEnvFile(envPath);
  }

  // Build the project
  console.log('');
  const shouldBuild = await question('  Build the project? (Y/n): ');
  if (shouldBuild.toLowerCase() !== 'n') {
    console.log('');
    console.log('  Building Mission Control...');
    try {
      execSync('npm run build', { cwd: installDir, stdio: 'inherit' });
      console.log('  ✅ Build complete!');
    } catch (err) {
      console.log('  ⚠️  Build failed. You may need to run "npm run build" manually.');
    }
  }

  // Ask about systemd service (Linux only)
  if (process.platform === 'linux') {
    console.log('');
    const setupService = await question('  Setup systemd service? (y/N): ');
    if (setupService.toLowerCase() === 'y') {
      await setupSystemdService(installDir);
    }
  }

  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║           ✅ Setup Complete!               ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');
  console.log('  Start Mission Control:');
  console.log('    mission-control');
  console.log('');
  if (process.platform === 'linux') {
    console.log('  Or with systemd:');
    console.log('    sudo systemctl start mission-control');
    console.log('');
  }

  rl.close();
}

async function createEnvFile(envPath) {
  console.log('');
  console.log('  📝 Creating .env file...');
  console.log('');

  const secret = crypto.randomBytes(32).toString('hex');
  const gatewaySecret = crypto.randomBytes(32).toString('hex');

  const port = await question('  Server Port (default: 4000): ') || '4000';
  const ttydPort = await question('  TTYD Port (default: 3001): ') || '3001';
  const dbPath = await question('  Database path (default: ./mission-control.db): ') || './mission-control.db';

  const gatewayUrl = await question('  OpenClaw Gateway URL (default: ws://127.0.0.1:18789): ') || 'ws://127.0.0.1:18789';

  const envContent = `# Mission Control Configuration
# Generated: ${new Date().toISOString()}

# Server
PORT=${port}
NODE_ENV=production

# Database
DATABASE_PATH=${dbPath}

# OpenClaw Gateway
MC_OPENCLAW_GATEWAY_URL=${gatewayUrl}
OPENCLAW_GATEWAY_TOKEN=

# Security
SESSION_SECRET=${secret}

# Terminal (TTYD)
NEXT_PUBLIC_TTYD_PORT=${ttydPort}

# Email (optional - configure later)
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=
`;

  fs.writeFileSync(envPath, envContent);
  console.log(`  ✅ Created ${envPath}`);
}

async function setupSystemdService(installDir) {
  console.log('');
  console.log('  ⚙️  Setting up systemd service...');

  let npmPath;
  try {
    npmPath = execSync('which npm').toString().trim();
  } catch (err) {
    console.log('  ⚠️  Could not find npm path.');
    return;
  }

  const serviceContent = `[Unit]
Description=Mission Control
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${installDir}
ExecStart=${npmPath} run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=${installDir}/.env

[Install]
WantedBy=multi-user.target
`;

  const servicePath = '/etc/systemd/system/mission-control.service';

  try {
    fs.writeFileSync('/tmp/mission-control.service', serviceContent);
    execSync(`sudo mv /tmp/mission-control.service ${servicePath}`);
    execSync('sudo systemctl daemon-reload');
    execSync('sudo systemctl enable mission-control');
    console.log('  ✅ Systemd service installed and enabled');
    console.log('     Start with: sudo systemctl start mission-control');
  } catch (err) {
    console.log('  ⚠️  Could not setup systemd service automatically.');
    console.log('     Error:', err.message);
  }
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});