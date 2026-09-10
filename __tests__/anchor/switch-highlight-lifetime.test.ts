import fs from 'fs';
import path from 'path';

const reader = fs.readFileSync(path.join(__dirname, '../../components/ReaderView.tsx'), 'utf8');
const pager = fs.readFileSync(path.join(__dirname, '../../components/HorizontalReaderPager.tsx'), 'utf8');

test('horizontal highlight animation fades the background without fading its text', () => {
  const frames = pager.slice(pager.indexOf('@keyframes readerSwitchPulse'), pager.indexOf('@keyframes readerSwitchFade'));
  expect(frames).toContain('background-color:transparent');
  expect(frames).not.toContain('opacity:');
});

test('vertical explicit highlight waits for reveal and cannot be replaced by live reports', () => {
  let marker: any = null;
  const document = {
    getElementById: () => marker,
    createElement: () => ({ dataset: {}, style: {}, addEventListener: jest.fn() }),
    body: { appendChild: (value: any) => { marker = value; } },
  };
  const window: any = { scrollX: 0, scrollY: 0, __activeProgrammaticTargetNonce: 42 };
  const start = reader.indexOf('              function drawReaderSwitchHighlight(');
  const end = reader.indexOf('              window.__highlightSwitchWordAtIndex', start);
  const draw = new Function('window', 'document', 'clearReaderSwitchHighlight',
    reader.slice(start, end) + '\nreturn drawReaderSwitchHighlight;')(window, document, () => { marker = null; });
  const range = { getClientRects: () => [{ left: 10, top: 20, width: 50, height: 20 }] };
  draw(range, true);
  expect(marker.style.animationPlayState).toBe('paused');
  const explicit = marker;
  draw(range, false);
  expect(marker).toBe(explicit);
  const releaseStart = reader.indexOf("      if (message.type === 'releaseSourceDestination') {");
  const releaseEnd = reader.indexOf('      window.__tryPendingSourceDestination', releaseStart);
  new Function('window', 'document', 'message', reader.slice(releaseStart, releaseEnd))(
    window, document, { type: 'releaseSourceDestination' });
  expect(marker.style.animationPlayState).toBe('running');
});
