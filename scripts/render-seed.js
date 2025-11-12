require('dotenv').config();
const { query } = require('../server/database/db');
const bcrypt = require('bcrypt');

async function main() {
  console.log('Seeding demo accounts for Render...');
  const adminPass = await bcrypt.hash('Admin@123456', 12);
  const teacherPass = await bcrypt.hash('Teacher@123', 12);
  const studentPass = await bcrypt.hash('Student@123', 12);

  const ensureUser = async (name, reg, email, pass, role, extra = {}) => {
    const existing = await query('SELECT id FROM users WHERE registration_number = $1', [reg]);
    if (existing.length) return existing[0].id;
    const cols = ['name','registration_number','email','password','role','department'];
    const vals = [name, reg, email, pass, role, extra.department || 'CSE'];
    if (role === 'student') { cols.push('year','section'); vals.push(3,'A'); }
    if (role === 'teacher') { cols.push('subjects_taught'); vals.push(extra.subjects_taught || 'Data Structures, Algorithms'); }
    const placeholders = cols.map((_,i)=>`$${i+1}`).join(',');
    const sql = `INSERT INTO users (${cols.join(',')}) VALUES (${placeholders}) RETURNING id`;
    const rows = await query(sql, vals);
    return rows[0].id;
  };

  const adminId = await ensureUser('Admin One','ADM2025001','admin1@iter.edu',adminPass,'admin',{department:'Administration'});
  const tchId = await ensureUser('Prof. Ada Lovelace','TCH2025001','teacher1@iter.edu',teacherPass,'teacher',{department:'CSE',subjects_taught:'Data Structures, Algorithms'});
  const stuId = await ensureUser('Demo Student','STU20250001','student1@iter.edu',studentPass,'student',{department:'CSE'});

  console.log('✓ Seeded IDs =>', { adminId, tchId, stuId });
}

main().catch(err => { console.error(err); process.exit(1); });
