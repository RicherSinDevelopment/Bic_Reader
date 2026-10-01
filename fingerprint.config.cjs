/** @type {import('expo/fingerprint').Config} */
const config = {
  // These XCFrameworks are deterministic build outputs created by
  // eas-build-pre-install. Hashing them would make the pre-install and
  // post-install fingerprints differ even when the native source is unchanged.
  ignorePaths: [
    'modules/bic-pdf-reader/ios/Frameworks/**/*',
    'pdf_reader/target/**/*',
    'pdf_reader/output.json',
  ],
  // The generated frameworks are derived from this Rust crate and its build
  // scripts, so include those inputs explicitly in the runtime fingerprint.
  extraSources: [
    {
      type: 'dir',
      filePath: 'pdf_reader',
      reasons: ['bicPdfReaderNativeSource'],
    },
  ],
};

module.exports = config;
