#!/usr/bin/env node

/**
 * Setup Script for ITER EduHub
 * Initializes database, creates sample files, and seeds data
 */

const fs = require('fs').promises;
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createSampleFiles() {
    log('\n📁 Creating sample seed files...', 'cyan');
    
    const uploadsDir = path.join(__dirname, 'server', 'seed', 'uploads');
    
    try {
        await fs.mkdir(uploadsDir, { recursive: true });
        
        // Create sample PDFs (text files for now)
        const sampleFiles = [
            {
                name: 'Sample_Notes_DataStructures.pdf',
                content: `DATA STRUCTURES - LECTURE NOTES
                
Chapter 1: Introduction to Data Structures
============================================

1.1 What are Data Structures?
Data structures are specialized formats for organizing, processing, retrieving and storing data.

1.2 Types of Data Structures
- Linear: Arrays, Linked Lists, Stacks, Queues
- Non-Linear: Trees, Graphs
- Hash-based: Hash Tables, Maps

1.3 Importance
- Efficient data management
- Improved algorithm performance
- Better code organization

Exercise:
1. Implement a stack using arrays
2. Write a function to reverse a linked list
3. Create a binary search tree

End of Chapter 1
`
            },
            {
                name: 'Assignment_1_OOP.pdf',
                content: `OBJECT ORIENTED PROGRAMMING
Assignment 1 - Due: December 31, 2025

Questions:

1. Write a Java program to demonstrate inheritance with at least 3 levels.

2. Implement a simple banking system with the following classes:
   - Account (base class)
   - SavingsAccount (derived)
   - CurrentAccount (derived)
   
3. Demonstrate polymorphism by creating:
   - Method overloading (compile-time)
   - Method overriding (runtime)

4. Create a class diagram for a Library Management System.

5. Implement exception handling for:
   - Invalid account number
   - Insufficient balance
   - Invalid withdrawal amount

Submission Guidelines:
- Submit as a zip file
- Include source code and screenshots
- Add a README with execution instructions

Total Marks: 100
`
            },
            {
                name: 'Timetable_CSE_3A.pdf',
                content: `TIMETABLE - CSE 3A
Academic Year: 2025-26, Semester: Odd

Monday:
09:00-10:00  Data Structures Lab       Room: LAB-301
10:00-11:00  Operating Systems         Room: CR-15
11:00-12:00  Computer Networks         Room: CR-15
12:00-01:00  DBMS                      Room: CR-16
02:00-03:00  Software Engineering      Room: CR-15
03:00-04:00  Elective-I                Room: CR-17

Tuesday:
09:00-10:00  Operating Systems         Room: CR-15
10:00-11:00  Computer Networks Lab     Room: LAB-302
11:00-12:00  Computer Networks Lab     Room: LAB-302
12:00-01:00  DBMS                      Room: CR-16
02:00-03:00  Software Engineering Lab  Room: LAB-303
03:00-04:00  Software Engineering Lab  Room: LAB-303

Wednesday:
09:00-10:00  Data Structures           Room: CR-15
10:00-11:00  Operating Systems         Room: CR-15
11:00-12:00  Computer Networks         Room: CR-15
12:00-01:00  DBMS Lab                  Room: LAB-304
02:00-03:00  DBMS Lab                  Room: LAB-304
03:00-04:00  Elective-I                Room: CR-17

Thursday:
09:00-10:00  Data Structures           Room: CR-15
10:00-11:00  Operating Systems Lab     Room: LAB-301
11:00-12:00  Operating Systems Lab     Room: LAB-301
12:00-01:00  Software Engineering      Room: CR-16
02:00-03:00  DBMS                      Room: CR-16
03:00-04:00  Sports/Activity           Ground

Friday:
09:00-10:00  Data Structures           Room: CR-15
10:00-11:00  Computer Networks         Room: CR-15
11:00-12:00  DBMS                      Room: CR-16
12:00-01:00  Software Engineering      Room: CR-15
02:00-03:00  Elective-I                Room: CR-17
03:00-04:00  Library/Self Study        Library
`
            },
            {
                name: 'Hostel_Menu_Week1.pdf',
                content: `HOSTEL MESS MENU - WEEK 1
November 2025

MONDAY
Breakfast: Idli, Sambar, Chutney, Tea/Coffee
Lunch: Rice, Dal, Mixed Veg, Chapati, Curd
Snacks: Samosa, Tea
Dinner: Rice, Paneer Curry, Chapati, Salad

TUESDAY
Breakfast: Poha, Tea/Coffee, Banana
Lunch: Rice, Rajma, Aloo Gobi, Chapati, Pickle
Snacks: Bread Pakora, Tea
Dinner: Rice, Chicken Curry, Chapati, Raita

WEDNESDAY
Breakfast: Upma, Chutney, Tea/Coffee
Lunch: Rice, Chole, Bhindi Fry, Chapati, Curd
Snacks: Veg Cutlet, Tea
Dinner: Rice, Fish Curry, Chapati, Salad

THURSDAY
Breakfast: Paratha, Curd, Tea/Coffee
Lunch: Rice, Dal Makhani, Mix Veg, Chapati, Pickle
Snacks: Aloo Tikki, Tea
Dinner: Fried Rice, Manchurian, Soup

FRIDAY
Breakfast: Dosa, Sambar, Chutney, Tea/Coffee
Lunch: Rice, Kadhi, Aloo Fry, Chapati, Curd
Snacks: Spring Roll, Tea
Dinner: Rice, Egg Curry, Chapati, Salad

SATURDAY
Breakfast: Puri Bhaji, Tea/Coffee
Lunch: Biryani, Raita, Salad
Snacks: Burger, Cold Drink
Dinner: Rice, Dal, Veg Curry, Chapati, Sweet

SUNDAY (Special)
Breakfast: Chole Bhature, Tea/Coffee
Lunch: Special Rice, Paneer Butter Masala, Naan, Dessert
Snacks: Ice Cream, Cookies
Dinner: Rice, Chicken/Paneer, Chapati, Kheer
`
            },
            {
                name: 'Admit_Card_STU20250001.pdf',
                content: `ITER UNIVERSITY
ADMIT CARD - END SEMESTER EXAMINATION

Student Details:
Name: Aarav Kumar
Registration No: STU20250001
Department: Computer Science & Engineering
Year: 3rd Year, Section: A
Roll No: 2025001

Examination Schedule:

Date: 15-Dec-2025  |  09:00-12:00  |  Data Structures           |  Room: EH-101
Date: 17-Dec-2025  |  09:00-12:00  |  Operating Systems         |  Room: EH-102
Date: 19-Dec-2025  |  09:00-12:00  |  Computer Networks         |  Room: EH-103
Date: 21-Dec-2025  |  09:00-12:00  |  DBMS                      |  Room: EH-104
Date: 23-Dec-2025  |  09:00-12:00  |  Software Engineering      |  Room: EH-105

Instructions:
1. Report to the examination hall 15 minutes before the scheduled time
2. Bring your ID card and this admit card
3. Mobile phones and electronic devices are strictly prohibited
4. Follow all examination rules and regulations

Issued Date: 01-Dec-2025
Signature of Controller of Examinations

[OFFICIAL SEAL]
`
            }
        ];

        for (const file of sampleFiles) {
            await fs.writeFile(
                path.join(uploadsDir, file.name),
                file.content,
                'utf8'
            );
            log(`  ✓ Created ${file.name}`, 'green');
        }

        log(`✅ Created ${sampleFiles.length} sample files`, 'green');
    } catch (error) {
        log(`❌ Error creating sample files: ${error.message}`, 'red');
    }
}

async function createEnvFile() {
    log('\n🔧 Checking .env file...', 'cyan');
    
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, '.env.example');
    
    try {
        await fs.access(envPath);
        log('  ✓ .env file already exists', 'green');
    } catch {
        // .env doesn't exist, create it from example
        try {
            const envExample = await fs.readFile(envExamplePath, 'utf8');
            await fs.writeFile(envPath, envExample);
            log('  ✓ Created .env from .env.example', 'green');
            log('  ⚠️  Please update .env with your MySQL credentials!', 'yellow');
        } catch (error) {
            log(`  ❌ Error creating .env: ${error.message}`, 'red');
        }
    }
}

async function main() {
    log('╔════════════════════════════════════════╗', 'blue');
    log('║   ITER EduHub - Setup Script          ║', 'blue');
    log('╚════════════════════════════════════════╝', 'blue');
    
    await createEnvFile();
    await createSampleFiles();
    
    log('\n╔════════════════════════════════════════╗', 'green');
    log('║   Setup Complete!                      ║', 'green');
    log('╚════════════════════════════════════════╝', 'green');
    
    log('\n📋 Next Steps:', 'cyan');
    log('  1. Update .env with your MySQL credentials', 'yellow');
    log('  2. Run: npm install', 'yellow');
    log('  3. Run: npm run init:db', 'yellow');
    log('  4. Run: npm run seed', 'yellow');
    log('  5. Run: npm run dev', 'yellow');
    log('\n🌐 Access: http://localhost:5000', 'cyan');
    log('🎭 Demo Login: STU20250001 / Student@123\n', 'cyan');
}

main().catch(error => {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
});
