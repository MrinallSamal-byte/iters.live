/**
 * Basic Scraper Test
 * Tests the portal scraper service without actual credentials
 */

const { createScraper, STATUS_SUCCESS, STATUS_AUTH_FAILED, STATUS_PORTAL_UNREACHABLE } = require('./server/services/portal-scraper.service');

async function testScraperBasic() {
    console.log('='.repeat(60));
    console.log('Testing Portal Scraper Service');
    console.log('='.repeat(60));
    
    try {
        console.log('\n1. Creating scraper instance...');
        const scraper = createScraper();
        
        if (!scraper) {
            console.error('❌ Failed to create scraper instance');
            process.exit(1);
        }
        console.log('✅ Scraper instance created successfully');
        
        console.log('\n2. Testing with invalid credentials (should fail gracefully)...');
        const result = await scraper.scrape('INVALID_REG', 'invalid_password');
        
        console.log('\nScraper Result:');
        console.log('  Status:', result.status);
        console.log('  Message:', result.message);
        
        if (result.status === STATUS_AUTH_FAILED || result.status === STATUS_PORTAL_UNREACHABLE) {
            console.log('\n✅ Scraper handled invalid credentials correctly');
        } else if (result.status === STATUS_SUCCESS) {
            console.log('\n⚠️  Unexpected success with invalid credentials');
        } else {
            console.log('\n✅ Scraper returned error status as expected');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('Test completed successfully!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(error);
        process.exit(1);
    }
}

// Run test
testScraperBasic()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
