# Final archive privacy verification

Run this after creating the exact Release archive intended for TestFlight or App Store submission.

## Xcode workflow

1. Open `ios/BicReader.xcworkspace` in the supported Xcode version.
2. Select **Any iOS Device (arm64)** and the **Release** configuration, then use **Product → Archive**.
3. In Organizer, select the archive and generate the privacy report using Xcode's privacy-report/export interface.
4. Save the report with the release evidence and compare every collected data type, tracking domain, and required-reason API against `APP_STORE_PRIVACY_DECLARATION.md`.
5. Pay special attention to manifests contributed by RevenueCat, Google Sign-In, React Native, Expo modules, and `react-native-blob-util`.
6. Resolve unexplained entries before uploading. If an SDK genuinely collects a data type, update App Store Connect and the public policy; do not hide the entry only to make the report smaller.
7. Upload to TestFlight and review any privacy-manifest warning email from Apple.

## Release sign-off

- [ ] The app-level `PrivacyInfo.xcprivacy` is present in the BicReader target's Copy Bundle Resources phase.
- [ ] CocoaPods privacy-manifest aggregation is enabled.
- [ ] The archived report says tracking is disabled and contains no unexplained tracking domains.
- [ ] Required-reason API categories and reason codes match actual app/SDK behavior.
- [ ] App Store Connect includes all linked data and all third-party collection.
- [ ] Privacy Policy URL is public, works without signing in, and matches the shipped build.
- [ ] Account deletion was tested against a production-like account containing a cloud PDF, annotation, AI conversation, and RevenueCat customer.
- [ ] Apple subscription-management messaging was tested for a subscribed account.
