Pod::Spec.new do |s|
  s.name = 'BicPdfReader'
  s.version = '0.1.0'
  s.summary = 'Semantic PDF extraction for Bic Reader'
  s.description = 'Expo bridge to the Bic Reader Rust extraction engine.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Bic Reader'
  s.homepage = 'https://example.invalid/bic-reader'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.{c,h,swift}'

  rust_framework = File.join(__dir__, 'Frameworks', 'BicPdfReaderRust.xcframework')
  pdfium_framework = File.join(__dir__, 'Frameworks', 'Pdfium.xcframework')
  if File.exist?(rust_framework) && File.exist?(pdfium_framework)
    s.vendored_frameworks = [
      'Frameworks/BicPdfReaderRust.xcframework',
      'Frameworks/Pdfium.xcframework'
    ]
    s.frameworks = ['CoreGraphics']
    s.libraries = ['c++']
    s.pod_target_xcconfig = {
      'DEFINES_MODULE' => 'YES',
      'OTHER_SWIFT_FLAGS' => '$(inherited) -D BIC_PDF_RUST_LINKED'
    }
  else
    s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  end
end
