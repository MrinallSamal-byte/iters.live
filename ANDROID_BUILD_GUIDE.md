# ITER EduHub - Android App Build Guide

## 🎯 Quick Start

The Android app is a WebView-based native application that provides the complete ITER EduHub experience with all features from the website.

### ✅ Supported Android Versions
- **Minimum**: Android 9.0 (Pie) - API 28
- **Target**: Android 14 (Latest) - API 34
- **Tested on**: Android 9, 10, 11, 12, 13, 14

## 📱 Pre-built APK Download

**Don't want to build? Download the ready-to-install APK:**

### Latest Release
- **Direct Download**: [ITER.apk](https://github.com/MrinallSamal-byte/updated_iters.live/releases/latest/download/ITER.apk)
- **Releases Page**: [All Releases](https://github.com/MrinallSamal-byte/updated_iters.live/releases)
- **Size**: ~3-5 MB
- **Android**: 9+ (API 28+)

### Installation Steps:
1. Download APK to your Android device
2. Go to **Settings → Security → Install Unknown Apps**
3. Enable installation for your browser/file manager
4. Open the downloaded APK file
5. Tap **Install**
6. Open the app and enjoy!

## 🔄 GitHub Actions - Automated Build

The APK is automatically built and released using GitHub Actions.

### When Does the Build Run?
1. **Push to main branch** - Creates a new release automatically
2. **On new tags** (e.g., `v1.0.0`) - Creates a versioned release
3. **Manual trigger** - On-demand builds via workflow dispatch

### How to Trigger a Manual Build

1. Go to the **Actions** tab in the GitHub repository
2. Click on **"Build Android APK"** workflow
3. Click **"Run workflow"** dropdown on the right
4. Select the branch (usually `main`)
5. Choose whether to create a release
6. Click **"Run workflow"**

The workflow will:
- Build the Android APK
- Upload it as an artifact
- Create a GitHub release with the APK named `ITER.apk`
- Mark it as the latest release

### How to Create a Versioned Release

1. Create and push a new tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
2. The workflow will automatically run and create a release with that tag

### Workflow File Location
- `.github/workflows/android-build.yml`

## 🔨 Building from Source

### Prerequisites
1. **Android Studio** (Arctic Fox or newer)
   - Download: https://developer.android.com/studio
   - Install with Android SDK

2. **Java Development Kit (JDK)** 8 or 11
   - Included with Android Studio

### Method 1: Using Build Scripts (Easiest)

#### On Windows:
```powershell
# Build Debug APK
.\build-android.bat

# Build Release APK
.\build-android.ps1 -Release

# Build with custom URL
.\build-android.ps1 -Release -WebsiteUrl "https://your-domain.com"
```

#### On Mac/Linux:
```bash
cd android-app
./gradlew assembleDebug    # Debug APK
./gradlew assembleRelease  # Release APK
```

### Method 2: Using Android Studio

1. **Open Project**
   ```
   File → Open → Select 'android-app' folder
   ```

2. **Wait for Gradle Sync** (5-10 minutes first time)

3. **Update Website URL**
   - Open `app/src/main/java/edu/iter/eduhub/MainActivity.java`
   - Line 33: Change `WEBSITE_URL` to your domain

4. **Build APK**
   ```
   Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```

5. **Find APK**
   - Location: `app/build/outputs/apk/debug/app-debug.apk`

## 📋 Configuration

### Change Website URL
Edit `MainActivity.java`:
```java
private static final String WEBSITE_URL = "https://your-domain.com";
```

### Change App Name
Edit `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">ITER EduHub</string>
```

### Change Package Name
Edit `app/build.gradle`:
```gradle
defaultConfig {
    applicationId "edu.iter.eduhub"
}
```

### Change Colors
Edit `app/src/main/res/values/themes.xml`:
```xml
<item name="colorPrimary">#6366f1</item>
```

## 🎨 Customizing App Icon

Replace icons in these folders:
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

Use tools like:
- https://romannurik.github.io/AndroidAssetStudio/
- https://icon.kitchen/

## 📲 Installing APK

### Via USB (ADB)
```bash
# Connect device via USB
# Enable USB Debugging in Developer Options

adb install releases/ITER-EduHub-v1.0.0.apk

# Or install with replacement
adb install -r releases/ITER-EduHub-v1.0.0.apk
```

### Via Direct Download
1. Upload APK to your website
2. Create download link in your landing page
3. Users download and install on Android

### Via File Transfer
1. Copy APK to device via USB/Bluetooth/Email
2. Open file on device
3. Tap Install

## 🚀 Features

### ✅ Complete Website Mirror
- All pages accessible
- All features functional
- Same UI/UX as web version
- Real-time updates

### ✅ Native Android Integration
- File downloads to Downloads folder
- Share functionality
- Back button navigation
- Swipe to refresh
- Full-screen mode
- Session persistence

### ✅ Offline Support
- Caches pages for offline viewing
- Smart cache management
- Works without internet (cached content)

### ✅ Security
- HTTPS support
- Cookie security
- Secure storage
- Network security config

## 🐛 Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
cd android-app
gradlew clean
gradlew build --refresh-dependencies
```

### APK Won't Install
- Enable "Install from Unknown Sources"
- Uninstall old version first
- Check if APK is corrupted (re-download)

### App Shows White Screen
- Check internet connection
- Verify website URL is correct
- Clear app data (Settings → Apps → ITER EduHub → Clear Data)
- Update Android System WebView from Play Store

### Downloads Not Working
- Grant storage permission when prompted
- Check Downloads folder permissions
- Restart app

## 📊 APK Sizes

| Build Type | Size |
|------------|------|
| Debug | 5-7 MB |
| Release (unsigned) | 3-5 MB |
| Release (signed, optimized) | 2-3 MB |

## 🔐 Signing for Production

### Create Keystore
```bash
keytool -genkey -v -keystore iter-eduhub.keystore -alias iter-key -keyalg RSA -keysize 2048 -validity 10000
```

### Sign in Android Studio
1. `Build → Generate Signed Bundle / APK`
2. Select `APK`
3. Choose keystore
4. Enter passwords
5. Select `release`
6. Click `Finish`

## 📱 Publishing to Play Store

### Requirements
- Google Play Developer Account ($25 one-time)
- Signed release APK/AAB
- App assets (screenshots, icon, etc.)
- Privacy policy URL
- Content rating questionnaire

### Steps
1. Create app in Play Console
2. Upload signed APK/AAB
3. Add store listing details
4. Set pricing (free)
5. Complete content rating
6. Submit for review

**Review time**: 1-7 days

## 🔧 Advanced Configuration

### Enable ProGuard (Code Optimization)
Already configured in `app/build.gradle`:
```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
    }
}
```

### Add Splash Screen
Already configured! Edit `splash_background.xml` to customize.

### Add Deep Links
Already configured! Update `AndroidManifest.xml`:
```xml
<data android:scheme="https" android:host="your-domain.com" />
```

### Enable File Upload
Already supported! Users can upload files through the WebView.

## 📚 Resources

- [Android Developer Guide](https://developer.android.com/docs)
- [WebView Documentation](https://developer.android.com/guide/webapps/webview)
- [Material Design Guidelines](https://material.io/design)
- [Play Store Guidelines](https://play.google.com/about/developer-content-policy/)

## ❓ FAQ

**Q: Does it work offline?**
A: Yes! Cached pages work offline. New content requires internet.

**Q: Will it auto-update?**
A: If published on Play Store, yes. Otherwise, users need to manually install updates.

**Q: Can I customize the UI?**
A: The app displays your website. Customize your website's CSS for changes.

**Q: Does it support all Android features?**
A: Yes! Downloads, notifications, storage, camera (if website uses it), etc.

**Q: How to update the app?**
A: Rebuild APK with new version code, sign it, and redistribute.

## 💡 Tips

1. **Test on multiple devices** before publishing
2. **Use HTTPS** for your website (required for many features)
3. **Optimize website** for mobile viewing
4. **Add app version** to About page
5. **Enable crashlytics** for production monitoring

## 🤝 Support

Need help?
- Open an issue on GitHub
- Email: support@iter.edu
- Check the detailed README in android-app folder

---

**Built with ❤️ for ITER EduHub**
