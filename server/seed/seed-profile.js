/**
 * Profile Feature Seed Script
 * Creates demo user with avatar and admit card
 */

const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const db = require('../database/db');
const { calculateChecksum } = require('../utils/file.util');

// Sample user data
const DEMO_USER = {
    name: 'Demo Student',
    registration_number: 'SOA2025001',
    email: 'demo.student@college.edu',
    password: 'Password123!',
    role: 'student',
    phone: '+91-9876543210',
    department: 'CSE',
    year: 2,
    section: 'A'
};

/**
 * Create sample avatar image (base64 encoded small PNG)
 */
const createSampleAvatar = async () => {
    const uploadsDir = path.join(__dirname, '../../uploads/avatars');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Small 100x100 blue circle PNG (base64)
    const avatarBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJSSURBVHgB7d3BbcJAFITh/46FAlJKCumgBDoIHUAHpgPTQemAdBA6CB2EDkIJSAE+IJSSRFYkJOBd78z+n3SUWO/Bfo/kWBsAAAAAAAAAAAAAAAAAAAAAAAAAAOBHa+ce/XinX0YrYxvbuKZ1bGIV87hEPz7ok5mfIcIYxyaW8RxFDKOKcZxiFucYxDGuaRXv8RbLOP2HIXFuvXYZ1zjHJt7jGIvo4hCb6MdXdHGMU2yiji6O8RWbuI1rXOI1qjjEJvq4pnXMol9e4xjf0cUl5nGJ9zCWUU/rdOsf6thEPa3TrX+oYhP1tE63/qGKTdTTOl16iGV0sY/v6MdnLKKOQ3TRRRWb6KKKaVrFW1TTNEqYplXCNL0SpmkVMU2rhGkaJYYxTaOEMKZpFDGMaRpFDGOaRhHDmKZRxDSNIqZpFDFNo4hpGkVM0yhimkYR0zSKmKZRxDSNIqZpFDFNo4hpGkVM0yhimkYR0zSKmKZRxDCNIoYxTaOIYUzTKGKaRgnTtEqYplXCNK0SpmkVMU2rhGlaJUzTKmGaVgnTtEqYplXEMKZplBjGNI0SxjGNEsaYplXEMKZpFDGMaRpFDGOaRhHDmKZRxDCmaRQxjGkaRQxjmkYRw5imUcQwpmkUMYxpGkUM40m9EqbxpF4J03hSr4RpPKlXwjSe1CthmkYJ03hSr4RpPKlXwjSNEqbxpF4J03hSr4RpGiVM40m9EqZplDCNJ/VKmKZRwjSe1CthGk/qlTCNJ/VKmMaTeiVM40m9EqbxpF4J03hSr4RpPKlXwjSe1CthmkYJ03hSr4RpPKlXAAAAAAAAAAAAAAAAAAAAAAAAAMDPewDgMf8ReDq1qwAAAABJRU5ErkJggg==';
    
    const avatarBuffer = Buffer.from(avatarBase64, 'base64');
    const avatarPath = path.join(uploadsDir, 'demo-avatar.png');
    
    await fs.writeFile(avatarPath, avatarBuffer);
    return {
        path: avatarPath,
        filename: 'demo-avatar.png',
        publicUrl: '/uploads/avatars/demo-avatar.png'
    };
};

/**
 * Create default avatar
 */
const createDefaultAvatar = async () => {
    const uploadsDir = path.join(__dirname, '../../uploads/avatars');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Gray circle default avatar
    const defaultBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJLSURBVHgB7d3BbYNAFITh/46FAlJKSukgBToIHUAHpgPTQemAdBA6CB2EDkIJSAG+IhSSRVZkJOBdz8z+n3SUWO/Bfo/kWBsAAAAAAAAAAAAAAAAAAAAAAAAAAOBHa+ce/XinX0YrYxvbuKZ1bGIV87hEPz7ok5mfIcIYxyaW8RxFDKOKcZxiFucYxDGuaRXv8RbLOP2HIXFuvXYZ1zjHJt7jGIvo4hCb6MdXdHGMU2yiji6O8RWbuI1rXOI1qjjEJvq4pnXMol9e4xjf0cUl5nGJ9zCWUU/rdOsf6thEPa3TrX+oYhP1tE63/qGKTdTTOl16iGV0sY/v6MdnLKKOQ3TRRRWb6KKKaVrFW1TTNEqYplXCNL0SpmkVMU2rhGkaJYYxTaOEMKZpFDGMaRpFDGOaRhHDmKZRxDSNIqZpFDFNo4hpGkVM0yhimkYR0zSKmKZRxDSNIqZpFDFNo4hpGkVM0yhimkYR0zSKmKZRxDCNIoYxTaOIYUzTKGKaRgnTtEqYplXCNK0SpmkVMU2rhGlaJUzTKmGaVgnTtEqYplXEMKZplBjGNI0SxjGNEsaYplXEMKZpFDGMaRpFDGOaRhHDmKZRxDCmaRQxjGkaRQxjmkYRw5imUcQwpmkUMYxpGkUM40m9EqbxpF4J03hSr4RpPKlXwjSe1CthmkYJ03hSr4RpPKlXwjSNEqbxpF4J03hSr4RpGiVM40m9EqZplDCNJ/VKmKZRwjSe1CthGk/qlTCNJ/VKmMaTeiVM40m9EqbxpF4J03hSr4RpPKlXwjSe1CthmkYJ03hSr4RpPKlXAAAAAAAAAAAAAAAAAAAAAAAAAMDPewPgMf8ReDq1qwAAAABJRU5ErkJggg==';
    
    const defaultBuffer = Buffer.from(defaultBase64, 'base64');
    const defaultPath = path.join(uploadsDir, 'default-avatar.png');
    
    await fs.writeFile(defaultPath, defaultBuffer);
    return {
        path: defaultPath,
        filename: 'default-avatar.png',
        publicUrl: '/uploads/avatars/default-avatar.png'
    };
};

/**
 * Create sample admit card PDF content
 */
const createSampleAdmitCard = async (userInfo) => {
    const uploadsDir = path.join(__dirname, '../../uploads/admitcards');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Simple text-based "PDF" (in production, use a proper PDF library like pdfkit)
    const admitCardContent = `
========================================
       ADMIT CARD
       SIKSHA 'O' ANUSANDHAN
       (Deemed to be University)
========================================

Name: ${userInfo.name}
Registration No: ${userInfo.registration_number}
Department: ${userInfo.department}
Year: ${userInfo.year} | Section: ${userInfo.section}

Examination: End Semester Examination 2025
Exam Code: ESE-2025-01
Exam Date: 15th January 2025

Instructions:
1. Bring this admit card to the examination hall
2. Carry a valid photo ID proof
3. Report 30 minutes before exam time
4. Mobile phones are strictly prohibited

Signature of Controller of Examinations
________________________________________

Date: ${new Date().toLocaleDateString()}
========================================
    `;
    
    const filename = `admitcard-${userInfo.registration_number}.pdf`;
    const admitCardPath = path.join(uploadsDir, filename);
    
    await fs.writeFile(admitCardPath, admitCardContent);
    
    return {
        path: admitCardPath,
        filename: filename,
        publicUrl: `/uploads/admitcards/${filename}`
    };
};

/**
 * Main seed function
 */
async function seedProfile() {
    let connection;
    
    try {
        console.log('🌱 Starting profile feature seed...\n');
        
        // Get connection
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        // Check if demo user already exists
        const [existingUsers] = await connection.query(
            'SELECT id FROM users WHERE registration_number = ?',
            [DEMO_USER.registration_number]
        );
        
        let userId;
        
        if (existingUsers.length > 0) {
            console.log('⚠️  Demo user already exists. Updating...');
            userId = existingUsers[0].id;
            
            // Update user
            const hashedPassword = await bcrypt.hash(DEMO_USER.password, 10);
            await connection.query(
                `UPDATE users 
                 SET name = ?, email = ?, password = ?, phone = ?, 
                     department = ?, year = ?, section = ?
                 WHERE id = ?`,
                [
                    DEMO_USER.name,
                    DEMO_USER.email,
                    hashedPassword,
                    DEMO_USER.phone,
                    DEMO_USER.department,
                    DEMO_USER.year,
                    DEMO_USER.section,
                    userId
                ]
            );
        } else {
            console.log('✓ Creating demo user...');
            
            // Hash password
            const hashedPassword = await bcrypt.hash(DEMO_USER.password, 10);
            
            // Insert demo user
            const [userResult] = await connection.query(
                `INSERT INTO users 
                 (name, registration_number, email, password, role, phone, 
                  department, year, section)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    DEMO_USER.name,
                    DEMO_USER.registration_number,
                    DEMO_USER.email,
                    hashedPassword,
                    DEMO_USER.role,
                    DEMO_USER.phone,
                    DEMO_USER.department,
                    DEMO_USER.year,
                    DEMO_USER.section
                ]
            );
            
            userId = userResult.insertId;
        }
        
        console.log(`✓ Demo user: ${DEMO_USER.name} (ID: ${userId})`);
        
        // Create default avatar
        console.log('✓ Creating default avatar...');
        await createDefaultAvatar();
        
        // Create and upload demo avatar
        console.log('✓ Creating demo avatar...');
        const avatar = await createSampleAvatar();
        const avatarChecksum = await calculateChecksum(avatar.path);
        
        // Insert avatar file record
        const [avatarFile] = await connection.query(
            `INSERT INTO files 
             (original_name, stored_name, mime, size, checksum, uploaded_by, 
              public_url, file_type, approved)
             VALUES (?, ?, 'image/png', ?, ?, ?, ?, 'avatar', true)
             ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
            [
                'demo-avatar.png',
                avatar.filename,
                (await fs.stat(avatar.path)).size,
                avatarChecksum,
                userId,
                avatar.publicUrl
            ]
        );
        
        // Update user profile pic
        await connection.query(
            'UPDATE users SET profile_picture = ? WHERE id = ?',
            [avatar.publicUrl, userId]
        );
        
        console.log(`✓ Avatar uploaded: ${avatar.publicUrl}`);
        
        // Create and upload admit card
        console.log('✓ Creating admit card...');
        const admitCard = await createSampleAdmitCard(DEMO_USER);
        const admitCardChecksum = await calculateChecksum(admitCard.path);
        
        // Insert admit card file record
        const [admitCardFile] = await connection.query(
            `INSERT INTO files 
             (original_name, stored_name, mime, size, checksum, uploaded_by, 
              public_url, file_type, approved)
             VALUES (?, ?, 'application/pdf', ?, ?, ?, ?, 'admit_card', true)
             ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
            [
                admitCard.filename,
                admitCard.filename,
                (await fs.stat(admitCard.path)).size,
                admitCardChecksum,
                userId,
                admitCard.publicUrl
            ]
        );
        
        const admitCardFileId = admitCardFile.insertId;
        
        // Create admit card record
        await connection.query(
            `INSERT INTO admit_cards 
             (user_id, file_id, exam_code, exam_name, exam_date, is_active)
             VALUES (?, ?, 'ESE-2025-01', 'End Semester Examination 2025', '2025-01-15', true)
             ON DUPLICATE KEY UPDATE file_id = VALUES(file_id), is_active = true`,
            [userId, admitCardFileId]
        );
        
        console.log(`✓ Admit card created: ${admitCard.publicUrl}`);
        
        // Create activity log entries
        await connection.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta)
             VALUES 
             (?, 'seed_profile_photo', 'file', ?, ?),
             (?, 'seed_admit_card', 'admit_card', ?, ?)`,
            [
                userId,
                avatarFile.insertId,
                JSON.stringify({ seed: true }),
                userId,
                admitCardFileId,
                JSON.stringify({ seed: true, exam_code: 'ESE-2025-01' })
            ]
        );
        
        // Commit transaction
        await connection.commit();
        
        console.log('\n✅ Profile feature seed completed successfully!\n');
        console.log('Demo User Credentials:');
        console.log(`  Registration No: ${DEMO_USER.registration_number}`);
        console.log(`  Password: ${DEMO_USER.password}`);
        console.log(`  Email: ${DEMO_USER.email}\n`);
        
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ Seed failed:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
        // Close pool
        await db.end();
    }
}

// Run seed if called directly
if (require.main === module) {
    seedProfile()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = seedProfile;
