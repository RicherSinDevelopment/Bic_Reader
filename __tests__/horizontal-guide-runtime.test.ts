import { HORIZONTAL_GUIDE_RUNTIME } from '@/architecture/HorizontalGuideRuntime';

function runtime() {
  const frames: (() => void)[] = [];
  const measure = jest.fn(() => []);
  const window: any = { __readerGuideActive: false, ReactNativeWebView: { postMessage: jest.fn() } };
  const document = { fonts: { ready: Promise.resolve() }, querySelectorAll: measure,
    documentElement: { dir: 'ltr' } };
  const install = () => new Function('window', 'document', 'requestAnimationFrame', HORIZONTAL_GUIDE_RUNTIME)(
    window, document, (callback: () => void) => frames.push(callback));
  install();
  return { window, measure, frames, install };
}

test('disabled guides do no measuring and duplicate startup requests share one frame', async () => {
  const r = runtime();
  r.window.__reportGuideGeometry();
  await Promise.resolve();
  expect(r.frames).toHaveLength(0);
  expect(r.measure).not.toHaveBeenCalled();
  r.window.__readerGuideActive = true;
  for (let i = 0; i < 10; i++) r.window.__reportGuideGeometry();
  r.install(); // Repeated installation must not reset a queued startup pass.
  r.window.__reportGuideGeometry();
  await Promise.resolve();
  expect(r.frames).toHaveLength(1);
  r.frames.shift()!();
  expect(r.measure).toHaveBeenCalledTimes(1);
  expect(r.window.ReactNativeWebView.postMessage).toHaveBeenCalledTimes(1);
  expect(r.frames).toHaveLength(0);
});

test('closing before a queued measurement prevents work; reopening measures normally', async () => {
  const r = runtime();
  r.window.__readerGuideActive = true;
  r.window.__reportGuideGeometry();
  r.window.__readerGuideActive = false;
  await Promise.resolve();
  r.frames.shift()!();
  expect(r.measure).not.toHaveBeenCalled();
  r.window.__readerGuideActive = true;
  r.window.__reportGuideGeometry();
  await Promise.resolve();
  r.frames.shift()!();
  expect(r.measure).toHaveBeenCalledTimes(1);
});
