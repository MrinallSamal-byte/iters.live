/**
 * Add responsive-universal.css to all HTML files
 */

const fs = require('fs');
const path = require('path');

const directories = [
    './client/dashboard'
];

const cssLink = '<link rel="stylesheet" href="../css/responsive-universal.css">';

function addResponsiveCSSToFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf-8');
        
        // Skip if already has the link
        if (content.includes('responsive-universal.css')) {
            console.log(`✓ ${path.basename(filePath)} - Already has responsive-universal.css`);
            return;
        }
        
        // Find the last CSS link before </head>
        const lastCSSLinkMatch = content.match(/<link rel="stylesheet"[^>]*>(?=[\s\S]*<\/head>)/g);
        
        if (lastCSSLinkMatch) {
            const lastCSSLink = lastCSSLinkMatch[lastCSSLinkMatch.length - 1];
            
            // Add our CSS link after the last one
            content = content.replace(
                lastCSSLink,
                lastCSSLink + '\n    ' + cssLink
            );
            
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`✓ ${path.basename(filePath)} - Added responsive-universal.css`);
        } else {
            console.log(`⚠ ${path.basename(filePath)} - Could not find CSS links`);
        }
    } catch (error) {
        console.error(`✗ ${path.basename(filePath)} - Error:`, error.message);
    }
}

function processDirectory(directory) {
    console.log(`\n📁 Processing directory: ${directory}\n`);
    
    const files = fs.readdirSync(directory);
    
    files.forEach(file => {
        if (file.endsWith('.html')) {
            const filePath = path.join(directory, file);
            addResponsiveCSSToFile(filePath);
        }
    });
}

console.log('🚀 Adding responsive-universal.css to all HTML files...\n');

directories.forEach(dir => {
    if (fs.existsSync(dir)) {
        processDirectory(dir);
    } else {
        console.log(`⚠ Directory not found: ${dir}`);
    }
});

console.log('\n✅ Done! All HTML files have been updated.\n');
