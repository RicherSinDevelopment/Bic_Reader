# Maestro end-to-end testing

Maestro drives the real iOS application through accessibility. Keep Jest for
fast service and mapping checks; use Maestro for startup, navigation, native
orientation, and complete reader flows.

## One-time setup

1. Install Maestro using the command in the official Quick Start, then ensure
   `~/.maestro/bin` is on `PATH`.
2. Install Xcode and boot an iPhone simulator.
3. Build/install the development app with `npx expo run:ios`, or build an EAS
   simulator artifact with:

   ```sh
   npx eas-cli build --platform ios --profile preview-simulator
   ```

   An EAS simulator build must be downloaded and extracted, then installed:

   ```sh
   xcrun simctl install booted /absolute/path/to/BicReader.app
   ```

## Run flows

Run the deterministic guest smoke test:

```sh
npm run test:e2e:guest
```

For reader transitions, first import a small fixture PDF in the simulator. Its
library title must be stable, then run:

```sh
maestro test -e TEST_PDF_NAME="Maestro Test Book" .maestro/reader-transitions.yaml
```

Open Maestro Studio while authoring or debugging selectors:

```sh
maestro studio
```

Prefer accessibility labels over coordinates. Never put production passwords,
Apple credentials, PDF text, or Supabase service-role keys in a flow. Use a
dedicated test account if an authenticated flow is added.

## Release-critical flows to add next

- Import a PDF through the iOS document picker and through Share/Open In.
- Reach the five-PDF guest limit, sign in, and verify all five PDFs remain.
- Restore a known reading position after force-closing and relaunching.
- Switch Reader/Original in portrait and landscape.
- Exercise Premium AI success, daily quota, and parallel-request errors with a
  dedicated staging account.
- Delete a disposable test account and verify its cloud library is unavailable.

System pickers and Share/Open In are best run as separate iOS flows because
their labels vary by iOS version. Pin the simulator runtime used in CI.
