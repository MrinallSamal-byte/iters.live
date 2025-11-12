/**
 * Script to update all dashboard HTML files with responsive CSS
 */

const fs = require('fs');
const path = require('path');

const dashboardDir = path.join(__dirname);

// CSS links to add
const cssLinks = `    <link rel="stylesheet" href="../css/responsive-enhanced.css">
    <link rel="stylesheet" href="../css/button-fixes.css">`;

// Get all HTML files in dashboard directory
const files = fs.readdirSync(dashboardDir).filter(file => file.endsWith('.html'));

console.log(`Found ${files.length} HTML files to update...`);

files.forEach(file => {
    const filePath = path.join(dashboardDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already has the CSS links
    if (content.includes('responsive-enhanced.css')) {
        console.log(`✓ ${file} - Already updated`);
        return;
    }
    
    // Find the last stylesheet link before </head>
    const headEndIndex = content.indexOf('</head>');
    if (headEndIndex === -1) {
        console.log(`✗ ${file} - No </head> tag found`);
        return;
    }
    
    // Find the last <link> tag before </head>
    const lastLinkMatch = content.substring(0, headEndIndex).lastIndexOf('<link');
    if (lastLinkMatch === -1) {
        console.log(`✗ ${file} - No <link> tags found`);
        return;
    }
    
    // Find the end of that link tag
    const linkEndIndex = content.indexOf('>', lastLinkMatch) + 1;
    
    // Insert the new CSS links after the last link tag
    content = content.substring(0, linkEndIndex) + '\n' + cssLinks + content.substring(linkEndIndex);
    
    // Write the updated content
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${file} - Updated`);
});

console.log('\n✅ All dashboard files updated with responsive CSS!');
