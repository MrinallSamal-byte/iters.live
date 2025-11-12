# 📱 ITER EduHub - Android App - Quick Start

## 🚀 Get Started in 3 Steps

### Step 1: Choose Your Method

#### Option A: Download Pre-built APK (Easiest)
```
Just download and install - no building required!
Location: releases/ITER-EduHub-v1.0.0.apk
```

#### Option B: Build with One Command
```powershell
# Windows
.\build-android.ps1

# Mac/Linux  
cd android-app && ./gradlew assembleDebug
```

#### Option C: Use Android Studio
```
Open android-app folder in Android Studio → Build → Build APK
```

### Step 2: Configure Website URL

Edit `android-app/app/src/main/java/edu/iter/eduhub/MainActivity.java` line 33:
```java
private static final String WEBSITE_URL = "https://your-domain.com";
```

### Step 3: Install on Android

Transfer APK to device → Open → Install → Done!

## 📱 What You Get

✅ **Complete Website** - All pages and features  
✅ **Android 9+ Support** - Works on API 28-34  
✅ **3-5 MB Size** - Lightweight and fast  
✅ **Offline Support** - Smart caching  
✅ **Native Features** - Downloads, notifications, back button  
✅ **Secure** - HTTPS, secure storage, session persistence  

## 📚 Documentation

- **Quick Setup**: [ANDROID_SETUP.md](../ANDROID_SETUP.md)
- **Detailed Guide**: [ANDROID_BUILD_GUIDE.md](../ANDROID_BUILD_GUIDE.md)
- **App Details**: [README.md](README.md)
- **Releases**: [releases/README.md](../releases/README.md)

## 🔧 Requirements

- Android Studio (for building)
- Android 9+ device (for running)
- Internet connection (first use)

## ⚡ Quick Commands

```bash
# Build debug APK
cd android-app
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease

# Clean build
./gradlew clean assembleDebug

# Install on device
adb install app/build/outputs/apk/debug/app-debug.apk
```

## 🆘 Need Help?

1. Check [ANDROID_SETUP.md](../ANDROID_SETUP.md) for detailed instructions
2. Check [Troubleshooting](#troubleshooting) section below
3. Open an issue on GitHub

## 🐛 Troubleshooting

**Build fails?**
```bash
./gradlew clean
./gradlew build --refresh-dependencies
```

**App won't install?**
- Enable "Unknown Sources" in Android settings
- Uninstall old version first

**White screen?**
- Check website URL is correct
- Check internet connection
- Update Android System WebView

## 📊 Features

| Feature | Included |
|---------|----------|
| Full website access | ✅ |
| File downloads | ✅ |
| Offline support | ✅ |
| Push notifications | ✅ |
| Hardware back button | ✅ |
| Swipe to refresh | ✅ |
| Session persistence | ✅ |
| Dark mode | ✅ |

## 🎯 Next Steps

1. ✅ Build the app
2. ✅ Test on device
3. ✅ Sign for release
4. ✅ Upload to website
5. ✅ Publish (optional)

---

**Built with ❤️ for ITER EduHub**
