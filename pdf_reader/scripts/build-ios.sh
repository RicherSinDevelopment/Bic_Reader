#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$(cd "$CRATE_DIR/.." && pwd)"
OUTPUT_DIR="$APP_DIR/modules/bic-pdf-reader/ios/Frameworks"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

download_pdfium() {
  local flavor="$1"
  local target="$WORK_DIR/pdfium-$flavor"
  mkdir -p "$target"
  curl --fail --location --retry 3 \
    "https://github.com/bblanchon/pdfium-binaries/releases/latest/download/pdfium-ios-$flavor.tgz" \
    --output "$target/pdfium.tgz"
  tar -xzf "$target/pdfium.tgz" -C "$target"
}

download_pdfium device-arm64
download_pdfium simulator-arm64
download_pdfium simulator-x64

rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
export IPHONEOS_DEPLOYMENT_TARGET="16.4"
cargo build --manifest-path "$CRATE_DIR/Cargo.toml" --release --lib --features ios-static --target aarch64-apple-ios
cargo build --manifest-path "$CRATE_DIR/Cargo.toml" --release --lib --features ios-static --target aarch64-apple-ios-sim
cargo build --manifest-path "$CRATE_DIR/Cargo.toml" --release --lib --features ios-static --target x86_64-apple-ios

SIMULATOR_LIB_DIR="$WORK_DIR/simulator-libs"
mkdir -p "$SIMULATOR_LIB_DIR"
lipo -create \
  "$CRATE_DIR/target/aarch64-apple-ios-sim/release/libbic_pdf_reader.a" \
  "$CRATE_DIR/target/x86_64-apple-ios/release/libbic_pdf_reader.a" \
  -output "$SIMULATOR_LIB_DIR/libbic_pdf_reader.a"
lipo -create \
  "$WORK_DIR/pdfium-simulator-arm64/lib/libpdfium.dylib" \
  "$WORK_DIR/pdfium-simulator-x64/lib/libpdfium.dylib" \
  -output "$SIMULATOR_LIB_DIR/libpdfium.dylib"

create_pdfium_framework() {
  local dylib="$1"
  local headers="$2"
  local framework="$3"

  mkdir -p "$framework/Headers"
  cp "$dylib" "$framework/Pdfium"
  cp -R "$headers/." "$framework/Headers/"
  install_name_tool -id '@rpath/Pdfium.framework/Pdfium' "$framework/Pdfium"

  plutil -create xml1 "$framework/Info.plist"
  plutil -insert CFBundleDevelopmentRegion -string en "$framework/Info.plist"
  plutil -insert CFBundleExecutable -string Pdfium "$framework/Info.plist"
  plutil -insert CFBundleIdentifier -string com.bicreader.pdfium "$framework/Info.plist"
  plutil -insert CFBundleInfoDictionaryVersion -string 6.0 "$framework/Info.plist"
  plutil -insert CFBundleName -string Pdfium "$framework/Info.plist"
  plutil -insert CFBundlePackageType -string FMWK "$framework/Info.plist"
  plutil -insert CFBundleShortVersionString -string 1.0.0 "$framework/Info.plist"
  plutil -insert CFBundleVersion -string 1 "$framework/Info.plist"
}

PDFIUM_DEVICE_FRAMEWORK="$WORK_DIR/pdfium-device/Pdfium.framework"
PDFIUM_SIMULATOR_FRAMEWORK="$WORK_DIR/pdfium-simulator/Pdfium.framework"
create_pdfium_framework \
  "$WORK_DIR/pdfium-device-arm64/lib/libpdfium.dylib" \
  "$WORK_DIR/pdfium-device-arm64/include" \
  "$PDFIUM_DEVICE_FRAMEWORK"
create_pdfium_framework \
  "$SIMULATOR_LIB_DIR/libpdfium.dylib" \
  "$WORK_DIR/pdfium-simulator-arm64/include" \
  "$PDFIUM_SIMULATOR_FRAMEWORK"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
xcodebuild -create-xcframework \
  -library "$CRATE_DIR/target/aarch64-apple-ios/release/libbic_pdf_reader.a" -headers "$CRATE_DIR/include" \
  -library "$SIMULATOR_LIB_DIR/libbic_pdf_reader.a" -headers "$CRATE_DIR/include" \
  -output "$OUTPUT_DIR/BicPdfReaderRust.xcframework"
xcodebuild -create-xcframework \
  -framework "$PDFIUM_DEVICE_FRAMEWORK" \
  -framework "$PDFIUM_SIMULATOR_FRAMEWORK" \
  -output "$OUTPUT_DIR/Pdfium.xcframework"

echo "Created iOS device and simulator XCFrameworks in $OUTPUT_DIR"
