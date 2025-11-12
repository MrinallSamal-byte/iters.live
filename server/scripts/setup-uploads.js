/**
 * Setup Upload Directories
 * Creates required upload folders for profile feature
 */

const fs = require('fs');
const path = require('path');

const directories = [
    'uploads',
    'uploads/avatars',
    'uploads/admitcards',
    'uploads/assignments',
    'uploads/notes',
    'uploads/misc'
];

console.log('📁 Creating upload directories...\n');

directories.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✓ Created: ${dir}`);
    } else {
        console.log(`⊙ Already exists: ${dir}`);
    }
});

// Create .gitkeep files to preserve directories in git
directories.forEach(dir => {
    const gitkeepPath = path.join(__dirname, '..', dir, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '# Keep this directory in git\n');
    }
});

console.log('\n✅ Upload directories ready!\n');
