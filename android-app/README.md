# ITER EduHub - Android App

## 📱 Overview

This is the official Android app for ITER EduHub. It's a WebView-based application that provides a native Android experience while displaying the full website with all features.

## ✨ Features

- ✅ **Full Website Access**: Complete mirror of the web application
- ✅ **Android 9+ Support**: Works on Android 9 (Pie) and above
- ✅ **Offline Support**: Caches pages for offline access
- ✅ **File Downloads**: Native download manager integration
- ✅ **Swipe to Refresh**: Pull-to-refresh functionality
- ✅ **Hardware Back Button**: Navigate back through pages
- ✅ **Full Screen**: Immersive experience without browser UI
- ✅ **Session Persistence**: Maintains login sessions
- ✅ **Push Notifications**: Support for web push notifications
- ✅ **Dark Mode**: Follows system theme preference

## 🔧 Requirements

### For Building APK:
- **Android Studio**: Arctic Fox (2020.3.1) or newer
- **JDK**: Java Development Kit 8 or 11
- **Android SDK**: API 28 (Android 9.0) minimum
- **Gradle**: 7.0+ (included with Android Studio)

### For Running:
- **Android Device/Emulator**: Android 9.0+ (API 28+)

## 🚀 Quick Start

### Option 1: Build with Android Studio (Recommended)

1. **Install Android Studio**
   - Download from: https://developer.android.com/studio
   - Install Android SDK (API 28-34)

2. **Open Project**
   ```
   File → Open → Select 'android-app' folder
   ```

3. **Wait for Gradle Sync**
   - Android Studio will automatically download dependencies
   - This may take 5-10 minutes on first run

4. **Configure Website URL**
   - Open `app/src/main/java/edu/iter/eduhub/MainActivity.java`
   - Change line 33:
     ```java
     private static final String WEBSITE_URL = "https://your-actual-domain.com";
     ```

5. **Build APK**
   ```
   Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```
   
   APK location: `app/build/outputs/apk/release/app-release-unsigned.apk`

6. **Sign APK (for distribution)**
   ```
   Build → Generate Signed Bundle / APK → APK
   ```

### Option 2: Build with Gradle Command Line

1. **Navigate to android-app folder**
   ```bash
   cd android-app
   ```

2. **Build Debug APK**
   ```bash
   # Windows
   gradlew.bat assembleDebug
   
   # Mac/Linux
   ./gradlew assembleDebug
   ```

3. **Build Release APK**
   ```bash
   # Windows
   gradlew.bat assembleRelease
   
   # Mac/Linux
   ./gradlew assembleRelease
   ```

## 📦 Pre-built APK Download

If you just want to install the app without building:

1. Download the latest APK from the releases section
2. Enable "Install from Unknown Sources" on your Android device
3. Install the APK

**Download Link**: [ITER-EduHub-v1.0.0.apk](releases/ITER-EduHub-v1.0.0.apk)

## 🔑 Signing the APK

For production/Play Store release, you need to sign the APK:

### Create Keystore:
```bash
keytool -genkey -v -keystore iter-eduhub.keystore -alias iter-key -keyalg RSA -keysize 2048 -validity 10000
```

### Sign in Android Studio:
1. `Build → Generate Signed Bundle / APK`
2. Select `APK`
3. Choose your keystore file
4. Enter keystore password and key alias
5. Select `release` build variant
6. Click `Finish`

## 📱 Installation on Device

### Via USB (ADB):
```bash
adb install app-release.apk
```

### Via Direct Download:
1. Upload APK to your website
2. Download on Android device
3. Open downloaded file
4. Tap "Install"

## ⚙️ Configuration

### Update Website URL

Edit `MainActivity.java` line 33:
```java
private static final String WEBSITE_URL = "https://your-domain.com";
```

### Update App Name

Edit `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">ITER EduHub</string>
```

### Update Package Name

1. Edit `app/build.gradle`:
   ```gradle
   defaultConfig {
       applicationId "edu.iter.eduhub"
   }
   ```

2. Refactor package structure in Android Studio

### Update Colors

Edit `app/src/main/res/values/themes.xml`:
```xml
<item name="colorPrimary">#6366f1</item>
```

### Add App Icon

Replace these files with your icon:
- `app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72)
- `app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48)
- `app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96)
- `app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144)
- `app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192)

## 🎨 Features Explained

### WebView Configuration
- **JavaScript Enabled**: Full JS support for interactive features
- **DOM Storage**: localStorage and sessionStorage work perfectly
- **Cookies**: Full cookie support including third-party cookies
- **File Access**: Download and upload files
- **Cache**: Smart caching for offline access

### Download Manager
- Automatic file downloads
- Shows notification on download complete
- Files saved to Downloads folder
- Supports all file types

### Swipe to Refresh
- Pull down from top to refresh page
- Material Design ripple effect
- Smooth animations

### Back Navigation
- Hardware back button navigates through web history
- Exits app when no history available

## 🐛 Troubleshooting

### Gradle Sync Failed
```bash
# Clear cache and rebuild
./gradlew clean
./gradlew build --refresh-dependencies
```

### APK Not Installing
- Enable "Unknown Sources" in Android Settings
- Check if old version is installed (uninstall first)
- Ensure APK is not corrupted

### Website Not Loading
- Check internet connection
- Verify WEBSITE_URL is correct
- Check if website is accessible from browser
- For HTTPS, ensure valid SSL certificate

### White Screen on Launch
- Clear app data and cache
- Check WebView is enabled on device
- Update Android System WebView from Play Store

## 📊 App Size

- **Debug APK**: ~5-7 MB
- **Release APK (unoptimized)**: ~3-5 MB
- **Release APK (optimized)**: ~2-3 MB

## 🔒 Permissions

Required permissions:
- `INTERNET` - Load website content
- `ACCESS_NETWORK_STATE` - Check connectivity
- `WRITE_EXTERNAL_STORAGE` - Save downloads (Android 9 only)
- `READ_EXTERNAL_STORAGE` - Read downloads (Android 9 only)

## 📱 Testing

### On Emulator:
1. Open Android Studio AVD Manager
2. Create device with API 28+
3. Run app from Android Studio

### On Physical Device:
1. Enable Developer Options
2. Enable USB Debugging
3. Connect via USB
4. Run from Android Studio or install APK

## 🚀 Publishing to Google Play Store

1. **Create signed release APK**
2. **Create Play Store account** ($25 one-time fee)
3. **Prepare store listing**:
   - App title
   - Short description (80 chars)
   - Full description (4000 chars)
   - Screenshots (2-8 images)
   - Feature graphic (1024x500)
   - App icon (512x512)
4. **Complete questionnaire**
5. **Submit for review**

Typical review time: 1-7 days

## 📄 License

This app is part of the ITER EduHub project.

## 🤝 Support

For issues or questions:
- Open an issue on GitHub
- Contact: support@iter.edu

## 📚 Additional Resources

- [Android Developer Docs](https://developer.android.com/docs)
- [WebView Guide](https://developer.android.com/guide/webapps/webview)
- [Material Design](https://material.io/design)
- [Play Store Guidelines](https://play.google.com/about/developer-content-policy/)
