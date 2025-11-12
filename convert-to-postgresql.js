// Convert MySQL placeholders (?) to PostgreSQL ($1, $2, etc.) in all route files
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'server', 'routes');

function convertPlaceholders(content) {
  // Match SQL queries with ? placeholders
  let converted = content;
  let paramIndex = 0;
  
  // Find all queries and convert ? to $n
  converted = converted.replace(/query\s*\(\s*(['"`])([\s\S]*?)\1\s*,\s*\[/g, (match, quote, sql) => {
    let questionMarks = (sql.match(/\?/g) || []).length;
    let modifiedSql = sql;
    
    for (let i = 1; i <= questionMarks; i++) {
      modifiedSql = modifiedSql.replace('?', `$${i}`);
    }
    
    return `query(${quote}${modifiedSql}${quote}, [`;
  });
  
  return converted;
}

// Process all .js files in routes directory
fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const filePath = path.join(routesDir, file);
    console.log(`Processing: ${file}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const converted = convertPlaceholders(content);
    
    if (content !== converted) {
      // Backup original
      fs.writeFileSync(`${filePath}.mysql.backup`, content);
      // Write converted
      fs.writeFileSync(filePath, converted);
      console.log(`  ✅ Converted (backup created)`);
    } else {
      console.log(`  ⏭️  No changes needed`);
    }
  }
});

console.log('\n✅ Conversion complete!');
