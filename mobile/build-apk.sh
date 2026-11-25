#!/usr/bin/env bash
# Builds the release APK locally (macOS with Android Studio installed).
# Output: android/app/build/outputs/apk/release/app-release.apk  (copied to ./BKSC-Parking.apk)
set -euo pipefail
cd "$(dirname "$0")"

# Use Android Studio's bundled JDK and the default SDK location if not already set.
if [ -z "${JAVA_HOME:-}" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[ -d "$ANDROID_HOME" ] || { echo "Android SDK nahi mila: $ANDROID_HOME (Android Studio > SDK Manager se install karein)"; exit 1; }

npm install
npx expo prebuild --platform android --clean
(cd android && ./gradlew assembleRelease)
cp android/app/build/outputs/apk/release/app-release.apk ./BKSC-Parking.apk
echo "✅ APK ready: $(pwd)/BKSC-Parking.apk"
