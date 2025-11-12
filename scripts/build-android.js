#!/usr/bin/env node
/**
 * Android TWA/PWA Build Script
 * Generates configuration for Trusted Web Activity
 */

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../releases/android');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🤖 Building Android TWA configuration...\n');

// TWA Manifest (twa-manifest.json)
const twaManifest = {
  packageId: "edu.iter.collegemanagement",
  host: "iter-edu.example.com", // Replace with your actual domain
  name: "ITER EduHub",
  launcherName: "ITER EduHub",
  display: "standalone",
  themeColor: "#6366f1",
  backgroundColor: "#0f172a",
  enableNotifications: true,
  startUrl: "/",
  iconUrl: "/assets/icon-512.png",
  maskableIconUrl: "/assets/icon-512.png",
  monochromeIconUrl: "/assets/icon-512.png",
  splashScreenFadeOutDuration: 300,
  signingKey: {
    path: "./android.keystore",
    alias: "iter-edu-key"
  },
  appVersionName: "1.0.0",
  appVersionCode: 1,
  shortcuts: [
    {
      name: "Dashboard",
      shortName: "Dashboard",
      url: "/dashboard/student.html",
      icon: "/assets/icon-96.png"
    }
  ],
  generatorApp: "bubblewrap-cli",
  webManifestUrl: "/manifest.json",
  fallbackType: "customtabs",
  features: {
    locationDelegation: {
      enabled: false
    },
    playBilling: {
      enabled: false
    }
  },
  alphaDependencies: {
    enabled: false
  },
  enableSiteSettingsShortcut: true,
  isChromeOSOnly: false
};

// Write TWA manifest
const twaManifestPath = path.join(outputDir, 'twa-manifest.json');
fs.writeFileSync(twaManifestPath, JSON.stringify(twaManifest, null, 2));
console.log('✓ Created twa-manifest.json');

// Create build instructions
const instructions = `
# Android TWA Build Instructions

## Prerequisites
1. Install Android Studio (https://developer.android.com/studio)
2. Install Node.js and npm
3. Install Bubblewrap CLI: npm install -g @bubblewrap/cli

## Option 1: Using Bubblewrap CLI (Recommended)

### First Time Setup:
\`\`\`bash
cd releases/android
bubblewrap init --manifest=twa-manifest.json
\`\`\`

### Build APK:
\`\`\`bash
bubblewrap build
\`\`\`

### Build App Bundle (for Play Store):
\`\`\`bash
bubblewrap build --appBundle
\`\`\`

## Option 2: Manual Android Studio

1. Create a new Android project with Empty Activity
2. Add dependencies to build.gradle:
   \`\`\`gradle
   implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
   \`\`\`

3. Update AndroidManifest.xml with TWA configuration:
   \`\`\`xml
   <activity android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
             android:exported="true"
             android:theme="@style/Theme.LauncherActivity">
       <meta-data android:name="android.support.customtabs.trusted.DEFAULT_URL"
                  android:value="https://your-domain.com" />
       <intent-filter>
           <action android:name="android.intent.action.MAIN" />
           <category android:name="android.intent.category.LAUNCHER" />
       </intent-filter>
   </activity>
   \`\`\`

4. Add Digital Asset Links for verification

5. Build APK via Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)

## Deployment

### Testing on Device:
\`\`\`bash
adb install app-release.apk
\`\`\`

### Play Store Deployment:
1. Create app bundle: bubblewrap build --appBundle
2. Upload to Google Play Console
3. Complete store listing and publish

## Requirements for Android 9+
- targetSdkVersion: 33 (Android 13)
- minSdkVersion: 28 (Android 9)
- Supports all features on Android 9 and above

## Testing PWA Features
- Install PWA from browser first
- Test "Add to Home Screen"
- Verify offline functionality
- Test notifications and background sync

## Digital Asset Links Verification
Host this file at https://your-domain.com/.well-known/assetlinks.json:

\`\`\`json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "edu.iter.collegemanagement",
    "sha256_cert_fingerprints": ["YOUR_CERT_FINGERPRINT"]
  }
}]
\`\`\`

Get fingerprint:
\`\`\`bash
keytool -list -v -keystore android.keystore
\`\`\`

## Notes
- Replace 'your-domain.com' with actual production domain
- Update package name in twa-manifest.json
- Generate signing key for production builds
- Test thoroughly on various Android versions (9-14)
`;

const instructionsPath = path.join(outputDir, 'BUILD_INSTRUCTIONS.md');
fs.writeFileSync(instructionsPath, instructions);
console.log('✓ Created BUILD_INSTRUCTIONS.md');

// Create README
const readme = `
# ITER EduHub - Android App

This directory contains configuration files for building the Android app.

## Quick Start

\`\`\`bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=twa-manifest.json
bubblewrap build
\`\`\`

The APK will be generated in the \`app\` subdirectory.

See BUILD_INSTRUCTIONS.md for detailed information.
`;

const readmePath = path.join(outputDir, 'README.md');
fs.writeFileSync(readmePath, readme);
console.log('✓ Created README.md\n');

console.log('✅ Android TWA configuration completed!');
console.log('\nNext steps:');
console.log('1. Update your-domain.com in twa-manifest.json with your actual domain');
console.log('2. Run: npm install -g @bubblewrap/cli');
console.log('3. Run: cd releases/android && bubblewrap init --manifest=twa-manifest.json');
console.log('4. Run: bubblewrap build');
console.log('\nFor more details, see releases/android/BUILD_INSTRUCTIONS.md\n');
