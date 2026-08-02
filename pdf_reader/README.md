# Bic PDF semantic extraction engine

The engine converts positioned PDF glyphs into a single semantic reading stream. Original
columns are used only to determine reading order; Reader Mode controls all visible layout.

Desktop verification:

```sh
cargo test
cargo run -- path/to/document.pdf output.json
```

The iOS target uses the `ios-static` bindings feature. Run `scripts/build-ios.sh` on macOS to
download PDFium and create device/simulator XCFrameworks. Until both frameworks are present,
the Expo module remains available but reports `isPdfEngineLinked === false`.
