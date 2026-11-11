#!/usr/bin/env bash
# Packages dist/safari as a macOS app in a dmg. Needs macOS and Xcode; run `npm run build` first.
# Usage: scripts/package-safari.sh <path of the dmg to write>
#
# Signs with the first Developer ID Application certificate in the keychain, so the app can
# be installed and turned on as downloaded. CODESIGN_IDENTITY names another certificate, or
# set it to - for an ad-hoc signature.
# Notarizes when these three are set, and skips that otherwise:
#   APPLE_API_KEY_P8_BASE64  the App Store Connect API key file, in base64
#   APPLE_API_KEY_ID         the key's ID
#   APPLE_API_ISSUER_ID      the key's issuer ID
#
# Without a certificate the signature is ad-hoc: Apple silicon runs nothing with less, but
# Safari only turns the extension on with "Allow Unsigned Extensions" checked.
set -euo pipefail

OUTPUT_DMG="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
APP_NAME="YT Tweaks"
# The converter ends the app's identifier with the app's name whatever is asked for, and
# the extension's has to start with the app's, so this ends the same way.
BUNDLE_ID="com.dreaifekks.YT-Tweaks"
# Xcode's default is the version of its own SDK, which older systems can't open.
MACOS_DEPLOYMENT_TARGET="14.0"
# The app takes the extension's version; the converter writes 1.0.
VERSION="$(node -p "require('./dist/safari/manifest.json').version")"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

IDENTITY="${CODESIGN_IDENTITY:-}"
if [ -z "$IDENTITY" ]; then
  IDENTITY="$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application: .*\)"$/\1/p' | head -n 1)"
fi

if [ -n "$IDENTITY" ] && [ "$IDENTITY" != "-" ]; then
  # The team ID is in the brackets that end the certificate's name.
  TEAM_ID="$(printf '%s' "$IDENTITY" | sed -n 's/.*(\([A-Z0-9]\{10\}\))$/\1/p')"
  # The entitlements Xcode injects include get-task-allow, for debugging, which notarization
  # refuses, so the injection is off. The converter's project gets its sandbox from that
  # injection too, so the sandbox is given here: a Safari extension has to have one.
  ENTITLEMENTS_PATH="$WORK_DIR/release.entitlements"
  cat > "$ENTITLEMENTS_PATH" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-only</key>
  <true/>
</dict>
</plist>
PLIST
  # Notarization wants the hardened runtime and a trusted timestamp.
  SIGN_SETTINGS=(
    CODE_SIGN_IDENTITY="$IDENTITY"
    DEVELOPMENT_TEAM="$TEAM_ID"
    ENABLE_HARDENED_RUNTIME=YES
    OTHER_CODE_SIGN_FLAGS=--timestamp
    CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO
    CODE_SIGN_ENTITLEMENTS="$ENTITLEMENTS_PATH"
  )
else
  IDENTITY=""
  echo "No Developer ID certificate, so the signature is ad-hoc"
  SIGN_SETTINGS=(
    CODE_SIGN_IDENTITY="-"
    DEVELOPMENT_TEAM=""
  )
fi

xcrun safari-web-extension-converter ./dist/safari \
  --project-location "$WORK_DIR/project" \
  --app-name "$APP_NAME" \
  --bundle-identifier "$BUNDLE_ID" \
  --macos-only \
  --copy-resources \
  --swift \
  --no-open \
  --no-prompt \
  --force

xcodebuild \
  -project "$WORK_DIR/project/$APP_NAME/$APP_NAME.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -derivedDataPath "$WORK_DIR/build" \
  ARCHS="arm64 x86_64" \
  ONLY_ACTIVE_ARCH=NO \
  MACOSX_DEPLOYMENT_TARGET="$MACOS_DEPLOYMENT_TARGET" \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$VERSION" \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE_SPECIFIER="" \
  "${SIGN_SETTINGS[@]}" \
  -quiet \
  build

APP_PATH="$WORK_DIR/build/Build/Products/Release/$APP_NAME.app"
codesign --verify --deep --strict "$APP_PATH"

mkdir "$WORK_DIR/dmg"
cp -R "$APP_PATH" "$WORK_DIR/dmg/"
ln -s /Applications "$WORK_DIR/dmg/Applications"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$WORK_DIR/dmg" \
  -fs HFS+ \
  -format UDZO \
  -ov \
  "$OUTPUT_DMG"

if [ -z "$IDENTITY" ]; then
  exit 0
fi

codesign --force --timestamp --sign "$IDENTITY" "$OUTPUT_DMG"

if [ -z "${APPLE_API_KEY_P8_BASE64:-}" ] || [ -z "${APPLE_API_KEY_ID:-}" ] || [ -z "${APPLE_API_ISSUER_ID:-}" ]; then
  echo "No API key for notarization, so it's skipped"
  exit 0
fi

API_KEY_PATH="$WORK_DIR/AuthKey.p8"
printf '%s' "$APPLE_API_KEY_P8_BASE64" | base64 --decode > "$API_KEY_PATH"
NOTARY_AUTH=(--key "$API_KEY_PATH" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER_ID")
NOTARY_RESULT="$(xcrun notarytool submit "$OUTPUT_DMG" "${NOTARY_AUTH[@]}" --wait --output-format json)"
NOTARY_STATUS="$(printf '%s' "$NOTARY_RESULT" | node -p "JSON.parse(require('fs').readFileSync(0)).status")"
if [ "$NOTARY_STATUS" != "Accepted" ]; then
  echo "Notarization didn't pass: $NOTARY_STATUS"
  xcrun notarytool log "$(printf '%s' "$NOTARY_RESULT" | node -p "JSON.parse(require('fs').readFileSync(0)).id")" "${NOTARY_AUTH[@]}"
  exit 1
fi
xcrun stapler staple "$OUTPUT_DMG"
spctl --assess --type open --context context:primary-signature --verbose "$OUTPUT_DMG"
