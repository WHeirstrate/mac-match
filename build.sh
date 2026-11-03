#!/bin/zsh
# Builds Encore!.app (a small native window around the HTML game) into ./build
set -euo pipefail
cd "$(dirname "$0")"

APP="build/Encore!.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "→ compiling"
swiftc -O -target "$(uname -m)-apple-macos12.0" mac/main.swift -o "$APP/Contents/MacOS/Encore" -framework Cocoa -framework WebKit

echo "→ copying game"
cp -R game "$APP/Contents/Resources/game"

echo "→ icon"
TMP="$(mktemp -d)"
swift mac/make_icon.swift "$TMP/icon.png" 2>/dev/null && {
  mkdir -p "$TMP/AppIcon.iconset"
  for s in 16 32 64 128 256 512; do
    sips -z $s $s "$TMP/icon.png" --out "$TMP/AppIcon.iconset/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) "$TMP/icon.png" --out "$TMP/AppIcon.iconset/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$TMP/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
} || echo "  (icon skipped)"
rm -rf "$TMP"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Encore!</string>
  <key>CFBundleDisplayName</key><string>Encore!</string>
  <key>CFBundleIdentifier</key><string>be.local.encore-match</string>
  <key>CFBundleExecutable</key><string>Encore</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.puzzle-games</string>
</dict></plist>
PLIST

python3 - <<'PY'
h = open('game/index.html').read()
h = h.replace('<link rel="stylesheet" href="style.css">', '<style>' + open('game/style.css').read() + '</style>')
for f in ('levels.js', 'game.js'):
    h = h.replace(f'<script src="{f}"></script>', '<script>' + open('game/' + f).read() + '</script>')
open('build/encore.html', 'w').write(h)
PY

codesign --force --sign - "$APP" >/dev/null 2>&1 || true
echo "✓ built $APP — run: open \"$APP\""
