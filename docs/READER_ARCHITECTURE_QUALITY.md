# Reader transition architecture and quality gates

## State model

The app has three rendered states:

1. Reader vertical
2. Reader horizontal
3. Original PDF

Transitions capture a canonical source anchor and restore that anchor in the
destination renderer. Generated horizontal page numbers and vertical pixel
offsets are not durable identity because both change when text reflows.

The canonical anchor contains the source PDF page, source block ID, word index,
character offset, normalized block progress, document ID, revision, and
timestamp.

## Automated quality gates

Run `npm run test:anchor` for the regression suite and
`npm run test:anchor:coverage` for coverage. The suite covers all six directed
edges among the three states, horizontal repagination, selected-word transfer,
stale-anchor rejection, transition retry/failure, and superseded transitions.

## Runtime measurements

Every completed transition records privacy-safe duration, accuracy, retry,
source, and destination metrics. Development builds print these measurements.
Slow transitions over 2.5 seconds and accuracy below 90 are reported to Sentry
without document text, filenames, questions, or user identity.

## Release targets

- Transition success rate: at least 99.5% across 200 real-device transitions.
- Average accuracy: at least 95.
- Wrong-page rate: 0%.
- Same-page wrong-block rate: below 1%.
- Warm transition p50: below 500 ms.
- Warm transition p95: below 1,200 ms.

Unit tests prove mapping logic, not WebView or PDFKit geometry. Before release,
run a physical-device matrix using small, large, RTL, image-only, and malformed
PDFs in portrait and landscape.

## Known precision boundary

Original PDF verification is currently page-level. The highlight coordinates
provide the word target, but PDFKit does not report a verified top-left word
back to the canonical controller.
