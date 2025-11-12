#!/bin/bash

# Comprehensive Dummy Data Setup Script
# This script sets up the complete database with realistic dummy data

echo "======================================================"
echo "  ITER College Management System"
echo "  Comprehensive Dummy Data Setup"
echo "======================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

echo ""
echo -e "${BLUE}🗄️  Setting up database with comprehensive dummy data...${NC}"
echo ""
echo -e "${YELLOW}⚠️  This will create:${NC}"
echo "  • 3 Admin accounts"
echo "  • 50 Teacher accounts"
echo "  • 500 Student accounts"
echo "  • 150,000+ attendance records"
echo "  • 100,000+ marks records"
echo "  • Complete timetables, events, clubs"
echo "  • Notes, assignments, announcements"
echo "  • And much more!"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Setup cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}🌱 Running comprehensive seed...${NC}"
npm run seed:comprehensive

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ SUCCESS! Database populated with realistic dummy data!${NC}"
    echo ""
    echo "======================================================"
    echo -e "${GREEN}  🎉 Setup Complete!${NC}"
    echo "======================================================"
    echo ""
    echo -e "${BLUE}Demo Credentials:${NC}"
    echo ""
    echo -e "${YELLOW}Student:${NC}"
    echo "  Registration: STU20250001"
    echo "  Password: Student@123"
    echo ""
    echo -e "${YELLOW}Teacher:${NC}"
    echo "  Registration: TCH2025001"
    echo "  Password: Teacher@123"
    echo ""
    echo -e "${YELLOW}Admin:${NC}"
    echo "  Registration: ADM2025001"
    echo "  Password: Admin@123456"
    echo ""
    echo "======================================================"
    echo -e "${GREEN}Ready to go!${NC} Start the server with: ${BLUE}npm start${NC}"
    echo "======================================================"
else
    echo ""
    echo -e "${RED}❌ Setup failed. Please check the error messages above.${NC}"
    exit 1
fi
