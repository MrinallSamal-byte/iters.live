#!/usr/bin/env node
/**
 * Fix all MySQL-style result.insertId to PostgreSQL RETURNING id
 * This script identifies INSERT queries that need RETURNING id clause
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'server', 'routes');

const filesToFix = [
  'marks.routes.js',
  'file.routes.js',
  'admin.routes.js',
  'event.routes.js',
  'rubric.routes.js',
  'teacher.routes.js',
  'question-bank.routes.js',
  'assignment.routes.js'
];

console.log('🔧 Fixing INSERT queries to use PostgreSQL RETURNING...\n');

filesToFix.forEach(filename => {
  const filePath = path.join(routesDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${filename} not found, skipping...`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: Find INSERT queries without RETURNING
  const insertPattern = /await query\([`'"](INSERT INTO [^`'"]+VALUES[^`'"]+)[`'"],\s*\[/g;
  
  content = content.replace(insertPattern, (match, insertQuery) => {
    if (!insertQuery.includes('RETURNING')) {
      modified = true;
      return match.replace(insertQuery, insertQuery + ' RETURNING id');
    }
    return match;
  });

  // Pattern 2: Replace result.insertId with result[0].id
  const insertIdPattern = /result\.insertId/g;
  if (insertIdPattern.test(content)) {
    content = content.replace(insertIdPattern, 'result[0].id');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filename} - Fixed INSERT queries and insertId references`);
  } else {
    console.log(`✓  ${filename} - No changes needed`);
  }
});

console.log('\n✅ All route files processed!');
console.log('\n⚠️  MANUAL REVIEW REQUIRED:');
console.log('   - Check each file for complex INSERT queries');
console.log('   - Verify RETURNING id is placed correctly');
console.log('   - Test each endpoint after deployment\n');
