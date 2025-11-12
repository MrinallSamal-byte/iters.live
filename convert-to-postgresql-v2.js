// Convert MySQL placeholders (?) to PostgreSQL ($1, $2, etc.) - IMPROVED VERSION
// This version ONLY converts ? inside SQL query strings, not in JavaScript code
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'server', 'routes');

function convertPlaceholders(content) {
  let converted = content;
  
  // Match query() calls with SQL strings containing ?
  // This regex finds: query('...?...', [...])
  converted = converted.replace(/query\s*\(\s*(['"`])((?:[^\\]|\\.)*?)\1\s*,\s*\[/g, (match, quote, sql) => {
    // Only process if it's actually SQL (contains SELECT, INSERT, UPDATE, DELETE, or WHERE)
    if (!/\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|INTO|SET)\b/i.test(sql)) {
      return match; // Not SQL, skip it
    }
    
    let questionMarks = (sql.match(/\?/g) || []).length;
    let modifiedSql = sql;
    
    // Replace each ? with $1, $2, $3, etc.
    for (let i = 1; i <= questionMarks; i++) {
      modifiedSql = modifiedSql.replace(/\?/, `$${i}`);
    }
    
    return `query(${quote}${modifiedSql}${quote}, [`;
  });
  
  return converted;
}

// Process all .js files in routes directory
let converted = 0;
let skipped = 0;

fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.js') && !file.endsWith('.backup')) {
    const filePath = path.join(routesDir, file);
    console.log(`Processing: ${file}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const result = convertPlaceholders(content);
    
    if (content !== result) {
      fs.writeFileSync(filePath, result);
      console.log(`  ✅ Converted`);
      converted++;
    } else {
      console.log(`  ⏭️  No changes needed`);
      skipped++;
    }
  }
});

console.log(`\n✅ Conversion complete!`);
console.log(`   Converted: ${converted} files`);
console.log(`   Skipped: ${skipped} files`);
