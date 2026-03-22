#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android-app');
const appBuildGradle = path.join(androidDir, 'app', 'build.gradle');
const isWindows = process.platform === 'win32';
const gradleExecutable = isWindows
  ? path.join(androidDir, 'gradlew.bat')
  : path.join(androidDir, 'gradlew');

const release = process.argv.includes('--release');
const skipTests = process.argv.includes('--skip-tests');
const dryRun = process.argv.includes('--dry-run');
const buildTask = release ? 'assembleRelease' : 'assembleDebug';
const artifactDir = path.join(rootDir, 'releases', 'android');

function fail(message) {
  console.error(`Android native build helper failed: ${message}`);
  process.exit(1);
}

function ensureNativeAndroidConfiguration() {
  if (!fs.existsSync(appBuildGradle)) {
    fail(`Missing Android module file: ${appBuildGradle}`);
  }

  const gradleText = fs.readFileSync(appBuildGradle, 'utf8');
  const minSdkMatch = gradleText.match(/minSdk(?:Version)?\s+(\d+)/);
  if (!minSdkMatch) {
    fail('Unable to determine minSdk from android-app/app/build.gradle.');
  }

  const minSdk = Number(minSdkMatch[1]);
  if (Number.isNaN(minSdk) || minSdk < 29) {
    fail(`android-app/app/build.gradle must target Android 10+ (found minSdk ${minSdk}).`);
  }
}

function runGradle(tasks) {
  if (!fs.existsSync(gradleExecutable)) {
    fail(`Gradle wrapper not found at ${gradleExecutable}.`);
  }

  const command = isWindows ? gradleExecutable : './gradlew';
  console.log(`Running native Android build: ${tasks.join(' ')}`);

  if (dryRun) {
    return;
  }

  execFileSync(command, [...tasks, '--no-daemon'], {
    cwd: androidDir,
    stdio: 'inherit',
    shell: isWindows
  });
}

function copyArtifact() {
  const artifactCandidates = release
    ? [
        path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
        path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk')
      ]
    : [path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')];

  const artifactPath = artifactCandidates.find((candidate) => fs.existsSync(candidate));

  if (!artifactPath) {
    console.warn(`Build completed, but no APK was found in expected locations:`);
    artifactCandidates.forEach((candidate) => console.warn(` - ${candidate}`));
    console.warn('If you produced an AAB-only release, collect it directly from android-app/app/build/outputs.');
    return;
  }

  fs.mkdirSync(artifactDir, { recursive: true });
  const fileName = release
    ? 'ITERasn-hub-native-release.apk'
    : 'ITERasn-hub-native-debug.apk';
  const releasePath = path.join(artifactDir, fileName);

  fs.copyFileSync(artifactPath, releasePath);
  console.log(`Copied APK to ${releasePath}`);
}

function main() {
  ensureNativeAndroidConfiguration();

  const tasks = [];
  if (!skipTests) {
    tasks.push('testDebugUnitTest');
  }
  tasks.push(buildTask);

  console.log('Building the native Android client in android-app/.');
  console.log(`Mode: ${release ? 'release' : 'debug'}`);
  console.log(`Unit tests: ${skipTests ? 'skipped' : 'enabled'}`);

  runGradle(tasks);
  if (!dryRun) {
    copyArtifact();
  }

  console.log('Native Android build helper finished.');
  console.log('This script no longer generates WebView/TWA/Bubblewrap wrappers.');
}

main();
