const path = require('path');
const fs = require('fs');
const file = path.join(__dirname, '..', 'database', 'migrations', '20251010_add_teacher_features.sql');
const sql = fs.readFileSync(file, 'utf8');
console.log('\nRun this SQL in your MySQL client to create Question Bank and Rubrics tables:\n');
console.log(sql);
