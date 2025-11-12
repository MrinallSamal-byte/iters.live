/**
 * Script to add responsive CSS to all dashboard HTML files
 */

const fs = require('fs');
const path = require('path');

const dashboardDir = path.join(__dirname, 'dashboard');
const cssLinks = `    <link rel="stylesheet" href="../css/responsive.css">
    <link rel="stylesheet" href="../css/mobile.css">`;

// Get all HTML files in dashboard directory
const files = fs.readdirSync(dashboardDir).filter(file => file.endsWith('.html'));

console.log(`Found ${files.length} dashboard HTML files to update...`);

files.forEach(file => {
    const filePath = path.join(dashboardDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if responsive CSS is already added
    if (content.includes('responsive.css')) {
        console.log(`✓ ${file} - Already has responsive CSS`);
        return;
    }
    
    // Find the last stylesheet link in the head section
    const headEndMatch = content.match(/<link rel="stylesheet"[^>]*>\s*(?=<)/);
    
    if (headEndMatch) {
        const insertPosition = headEndMatch.index + headEndMatch[0].length;
        content = content.slice(0, insertPosition) + '\n' + cssLinks + content.slice(insertPosition);
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ ${file} - Added responsive CSS`);
    } else {
        console.log(`✗ ${file} - Could not find insertion point`);
    }
});

console.log('\nResponsive CSS update complete!');
