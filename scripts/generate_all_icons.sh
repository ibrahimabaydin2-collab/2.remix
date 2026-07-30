#!/bin/bash
set -e

echo "=== 1. Generating 1024x1024 Master PNG from public/logo.svg ==="
npx @resvg/resvg-js-cli public/logo.svg /tmp/master_1024.png

echo "=== 2. Updating SVG files ==="
cp public/logo.svg logo.svg
mkdir -p android/app/src/main/assets/public
cp public/logo.svg android/app/src/main/assets/public/logo.svg

if [ -d "dist" ]; then
  cp public/logo.svg dist/logo.svg
fi

echo "=== 3. Updating Web Icons in public/ and dist/ ==="
cp /tmp/master_1024.png public/icon.png
convert /tmp/master_1024.png -resize 180x180 public/apple-touch-icon.png
convert /tmp/master_1024.png -resize 32x32 public/favicon.ico

if [ -d "dist" ]; then
  cp /tmp/master_1024.png dist/icon.png
  convert /tmp/master_1024.png -resize 180x180 dist/apple-touch-icon.png
  convert /tmp/master_1024.png -resize 32x32 dist/favicon.ico
fi

echo "=== 4. Updating Android Mipmap Icons ==="
# MDPI (48x48)
convert /tmp/master_1024.png -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert /tmp/master_1024.png -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
convert /tmp/master_1024.png -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png

# HDPI (72x72)
convert /tmp/master_1024.png -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert /tmp/master_1024.png -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
convert /tmp/master_1024.png -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png

# XHDPI (96x96)
convert /tmp/master_1024.png -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert /tmp/master_1024.png -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
convert /tmp/master_1024.png -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png

# XXHDPI (144x144)
convert /tmp/master_1024.png -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert /tmp/master_1024.png -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
convert /tmp/master_1024.png -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png

# XXXHDPI (192x192)
convert /tmp/master_1024.png -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
convert /tmp/master_1024.png -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
convert /tmp/master_1024.png -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png

echo "=== SUCCESS: All icon files updated and replaced! ==="
