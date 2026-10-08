#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns that identify high-risk leaked secrets
const SECRET_PATTERNS = [
  { name: 'OpenRouter API Key', regex: /sk-or-v1-[a-f0-9]{40,}/i },
  { name: 'OpenAI Secret Key', regex: /sk-(?:live|proj|test)-[a-zA-Z0-9_-]{20,}/i },
  { name: 'Postgres Connection String with Password', regex: /postgres(?:ql)?:\/\/[a-zA-Z0-9_-]+:(?!your-|test|change-)[^@\s"'\`]+@[a-zA-Z0-9_\-\.]+\.[a-z]{2,}/i },
  { name: 'Neon Password Token', regex: /npg_[a-zA-Z0-9_-]{12,}/i },
  { name: 'Stack Auth Secret Key', regex: /ssk_[a-zA-Z0-9]{20,}/i },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
];

// Files or directories to ignore
const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  '.nyc_output',
  'scripts/security/check-secrets.js' // Ignore self
];

function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', { encoding: 'utf8' });
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function scan() {
  console.log('🔍 Scanning tracked repository files for exposed secrets...');
  const files = getTrackedFiles();
  let foundViolations = 0;

  for (const file of files) {
    if (IGNORED_PATHS.some(ignored => file.startsWith(ignored))) {
      continue;
    }

    if (!fs.existsSync(file)) {
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // Binary file or unreadable
    }

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      // Skip commented-out generic placeholder examples if explicit
      if (line.includes('your-') || line.includes('change-this') || line.includes('placeholder') || line.includes('REPLACE_WITH_') || line.includes('BEGIN PRIVATE KEY') && line.includes('...')) {
        return;
      }

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          console.error(`❌ [${pattern.name}] detected in ${file}:${index + 1}`);
          foundViolations++;
        }
      }
    });
  }

  if (foundViolations > 0) {
    console.error(`\n🚨 Scan failed: ${foundViolations} potential secret(s) found!`);
    process.exit(1);
  } else {
    console.log('✅ Clean: No exposed secrets detected in tracked files.');
  }
}

scan();
