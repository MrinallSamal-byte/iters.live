# 📱 ITER EduHub - Android App Setup Guide

## 🎯 Overview

This guide will help you build and deploy the Android version of ITER EduHub. The app is a native WebView wrapper that provides the complete website experience with all features.

## ✨ What You Get

The Android app includes:
- ✅ **Complete Website**: All pages, features, and functionality
- ✅ **Native Experience**: File downloads, notifications, hardware back button
- ✅ **Offline Support**: Smart caching for offline access
- ✅ **Android 9+ Support**: Works on API 28-34 (Android 9-14)
- ✅ **Optimized**: 3-5 MB APK size, fast loading
- ✅ **Secure**: HTTPS support, secure storage, session persistence

## 🚀 Quick Start (3 Options)

### Option 1: Download Pre-built APK (Easiest)

If you just want to use the app without building:

1. **Download APK**
   - Location: `releases/ITER-EduHub-v1.0.0.apk`
   - Or build it first (see Option 2)

2. **Install on Android**
   - Transfer APK to your device
   - Open the file
   - Tap "Install"
   - Enable "Unknown Sources" if prompted

### Option 2: Build with Scripts (Recommended)

**Prerequisites:**
- Android Studio installed
- ANDROID_HOME environment variable set

**Windows (PowerShell):**
```powershell
# Build debug APK
.\build-android.ps1

# Build release APK
.\build-android.ps1 -Release

# Build with custom website URL
.\build-android.ps1 -Release -WebsiteUrl "https://your-domain.com"
```

**Windows (Command Prompt):**
```cmd
build-android.bat
```

**Mac/Linux:**
```bash
cd android-app
chmod +x gradlew
./gradlew assembleDebug
```

### Option 3: Build with Android Studio

1. **Install Android Studio**
   - Download: https://developer.android.com/studio
   - Install with default settings
   - Install Android SDK (API 28-34)

2. **Open Project**
   - Launch Android Studio
   - File → Open
   - Select `android-app` folder
   - Wait for Gradle sync (5-10 minutes first time)

3. **Configure Website URL**
   - Open: `app/src/main/java/edu/iter/eduhub/MainActivity.java`
   - Line 33: Update `WEBSITE_URL`
   ```java
   private static final String WEBSITE_URL = "https://your-domain.com";
   ```

4. **Build APK**
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Wait for build to complete
   - Click "locate" to find the APK

## 📋 Prerequisites

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| Android Studio | Arctic Fox+ | [Download](https://developer.android.com/studio) |
| JDK | 8 or 11 | Included with Android Studio |
| Gradle | 7.0+ | Included with project |
| Android SDK | API 28-34 | Install via Android Studio |

### Setting up Android Studio

1. **Download and Install**
   ```
   https://developer.android.com/studio
   ```

2. **SDK Manager Setup**
   - Open Android Studio
   - Tools → SDK Manager
   - Install:
     - Android 9.0 (Pie) - API 28
     - Android 14.0 - API 34
     - Android SDK Build-Tools
     - Android SDK Platform-Tools

3. **Environment Variables**
   
   **Windows:**
   ```powershell
   # Add to System Environment Variables
   ANDROID_HOME = C:\Users\YourName\AppData\Local\Android\Sdk
   
   # Add to PATH
   %ANDROID_HOME%\platform-tools
   %ANDROID_HOME%\tools
   ```

   **Mac/Linux:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   ```

4. **Verify Installation**
   ```bash
   adb version
   # Should show Android Debug Bridge version
   ```

## 🔧 Configuration

### 1. Website URL

Update the URL your app will load:

**File:** `android-app/app/src/main/java/edu/iter/eduhub/MainActivity.java`

```java
// Line 33
private static final String WEBSITE_URL = "https://your-domain.com";
```

**For local testing:**
```java
// Use 10.0.2.2 for Android emulator
private static final String WEBSITE_URL = "http://10.0.2.2:5000";

// Or use your computer's IP for physical device
private static final String WEBSITE_URL = "http://192.168.1.100:5000";
```

### 2. App Name

**File:** `android-app/app/src/main/res/values/strings.xml`

```xml
<resources>
    <string name="app_name">ITER EduHub</string>
</resources>
```

### 3. Package Name

**File:** `android-app/app/build.gradle`

```gradle
defaultConfig {
    applicationId "edu.iter.eduhub"  // Change this
    minSdk 28
    targetSdk 34
    versionCode 1
    versionName "1.0.0"
}
```

### 4. App Colors

**File:** `android-app/app/src/main/res/values/themes.xml`

```xml
<resources>
    <style name="Theme.ITEREduHub">
        <item name="colorPrimary">#6366f1</item>
        <item name="colorPrimaryVariant">#4f46e5</item>
        <item name="colorSecondary">#10b981</item>
    </style>
</resources>
```

### 5. App Icon

Replace icons in these folders with your custom icons:

```
android-app/app/src/main/res/
├── mipmap-mdpi/ic_launcher.png     (48x48)
├── mipmap-hdpi/ic_launcher.png     (72x72)
├── mipmap-xhdpi/ic_launcher.png    (96x96)
├── mipmap-xxhdpi/ic_launcher.png   (144x144)
└── mipmap-xxxhdpi/ic_launcher.png  (192x192)
```

**Generate icons:**
- https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
- https://icon.kitchen/

## 📦 Building

### Debug Build (For Testing)

```bash
cd android-app
./gradlew assembleDebug
```

**Output:** `app/build/outputs/apk/debug/app-debug.apk`

### Release Build (For Distribution)

```bash
cd android-app
./gradlew assembleRelease
```

**Output:** `app/build/outputs/apk/release/app-release-unsigned.apk`

### Clean Build

```bash
./gradlew clean
./gradlew assembleDebug
```

## 🔐 Signing for Production

### Create Keystore

```bash
keytool -genkey -v -keystore iter-eduhub.keystore \
  -alias iter-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Store safely:**
- Keystore file
- Keystore password
- Key alias
- Key password

### Sign in Android Studio

1. Build → Generate Signed Bundle / APK
2. Select "APK"
3. Click "Create new..." to create keystore (or select existing)
4. Fill in keystore details
5. Select "release" build variant
6. Click "Finish"

### Sign with Command Line

```bash
# Sign APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore iter-eduhub.keystore \
  app-release-unsigned.apk \
  iter-key

# Verify signature
jarsigner -verify -verbose -certs app-release-unsigned.apk

# Optimize with zipalign
zipalign -v 4 app-release-unsigned.apk ITER-EduHub-v1.0.0.apk
```

## 📲 Installation

### Method 1: USB (ADB)

```bash
# Connect device via USB
# Enable USB Debugging in Developer Options

# Install APK
adb install releases/ITER-EduHub-v1.0.0.apk

# Install with replacement
adb install -r releases/ITER-EduHub-v1.0.0.apk

# Uninstall
adb uninstall edu.iter.eduhub
```

### Method 2: Direct Download

1. Upload APK to your website
2. Users download on their Android device
3. Open downloaded file
4. Tap "Install"

**Landing page code:**
```html
<a href="/releases/ITER-EduHub-v1.0.0.apk" download>
    Download Android App
</a>
```

### Method 3: File Transfer

1. Copy APK to device via:
   - USB cable
   - Bluetooth
   - Email attachment
   - Cloud storage (Drive, Dropbox)
2. Open APK file on device
3. Tap "Install"

## 🧪 Testing

### On Emulator

1. **Create AVD** (Android Virtual Device)
   - Tools → AVD Manager → Create Virtual Device
   - Choose device (e.g., Pixel 4)
   - Select system image (API 28+)
   - Click Finish

2. **Run App**
   - Run → Run 'app'
   - Select emulator
   - Wait for app to install and launch

### On Physical Device

1. **Enable Developer Options**
   - Settings → About Phone
   - Tap "Build Number" 7 times

2. **Enable USB Debugging**
   - Settings → Developer Options
   - Enable "USB Debugging"

3. **Connect and Run**
   - Connect device via USB
   - Allow USB debugging popup
   - Run → Run 'app'
   - Select your device

### Testing Checklist

- [ ] App launches successfully
- [ ] Website loads correctly
- [ ] All pages accessible
- [ ] Login/logout works
- [ ] File downloads work
- [ ] Back button navigates
- [ ] Swipe to refresh works
- [ ] Session persists after close
- [ ] No crashes or errors
- [ ] Offline mode shows cached content

## 🚀 Publishing to Play Store

### Prerequisites

1. **Google Play Developer Account** ($25 one-time fee)
   - Sign up: https://play.google.com/console

2. **Signed Release APK/AAB**
   - Build signed release
   - Or use AAB: `./gradlew bundleRelease`

3. **App Assets**
   - App icon (512x512 PNG)
   - Feature graphic (1024x500 PNG)
   - Screenshots (2-8 images)
   - Short description (80 chars)
   - Full description (4000 chars)
   - Privacy policy URL

### Publishing Steps

1. **Create App in Play Console**
   - Go to Play Console
   - Create Application
   - Enter app details

2. **Upload APK/AAB**
   - Production → Create Release
   - Upload app-release.aab
   - Add release notes

3. **Store Listing**
   - Add title, description
   - Upload screenshots
   - Add graphic assets
   - Set category

4. **Content Rating**
   - Complete questionnaire
   - Get rating

5. **Pricing & Distribution**
   - Select Free/Paid
   - Choose countries
   - Accept declarations

6. **Submit for Review**
   - Review summary
   - Submit

**Review time:** 1-7 days typically

### Post-Publishing

- Monitor crash reports
- Respond to user reviews
- Release updates regularly
- Track metrics in Play Console

## 🐛 Troubleshooting

### Build Fails

**Problem:** Gradle sync fails
```bash
# Clear cache
./gradlew clean
rm -rf .gradle/
./gradlew build --refresh-dependencies
```

**Problem:** SDK not found
- Set ANDROID_HOME environment variable
- Install required SDK versions in SDK Manager

### Installation Fails

**Problem:** App won't install
- Enable "Install from Unknown Sources"
- Uninstall old version first
- Check device has enough storage
- Verify APK is not corrupted

### App Crashes

**Problem:** White screen or crash on launch
- Check website URL is correct
- Verify internet connection
- Update Android System WebView
- Clear app data

**Problem:** Downloads not working
- Grant storage permission
- Check Downloads folder access
- Restart app

### Performance Issues

**Problem:** Slow loading
- Optimize website performance
- Enable caching on server
- Reduce image sizes
- Minify CSS/JS

## 📊 Performance Tips

1. **Optimize Website**
   - Compress images
   - Minify CSS/JS
   - Enable gzip
   - Use CDN

2. **Enable Caching**
   ```java
   // In MainActivity.java
   webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
   ```

3. **Reduce APK Size**
   - Enable ProGuard (already configured)
   - Use WebP images for app assets
   - Remove unused resources

4. **Improve Loading**
   - Show splash screen (already implemented)
   - Add loading indicator
   - Preload common pages

## 📚 Resources

- [Android Developer Docs](https://developer.android.com/docs)
- [WebView Guide](https://developer.android.com/guide/webapps/webview)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [Material Design](https://material.io/design)

## 🆘 Getting Help

**Issues?**
- Check [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)
- Check [android-app/README.md](android-app/README.md)
- Open issue on GitHub
- Email: support@iter.edu

## ✅ Checklist

Before distributing your app:

- [ ] Website URL configured correctly
- [ ] App name and package name set
- [ ] Custom app icon added
- [ ] Colors match brand
- [ ] Tested on Android 9+
- [ ] Tested on different screen sizes
- [ ] All features working
- [ ] No crashes or errors
- [ ] APK signed for release
- [ ] Privacy policy created
- [ ] Store listing prepared

---

**🎉 Congratulations! Your Android app is ready to distribute!**
