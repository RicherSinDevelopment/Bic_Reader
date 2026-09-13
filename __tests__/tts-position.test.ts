import { ttsPositionForBlock, spokenWordForTtsOffset } from '@/architecture/TtsPosition';
const block = (id: string, text: string) => ({ id, text }) as any;
test('starts at the visible word rather than the start of the loaded window', () => {
  const blocks = [block('earlier', 'before'), block('visible', 'one two three')];
  const text = blocks.map(b => b.text.trim()).join('\n\n');
  expect(text.slice(ttsPositionForBlock(blocks, 'visible', 4))).toBe('two three');
});
test('keeps the same horizontal word when background extraction prepends pages', () => {
  const visible = block('visible', 'one two three');
  for (const blocks of [[visible], [block('old', 'earlier page'), visible]]) {
    const text = blocks.map(b => b.text.trim()).join('\n\n');
    expect(text.slice(ttsPositionForBlock(blocks, 'visible', 4))).toBe('two three');
  }
});
test('accounts for whitespace removed from speech text', () => {
  const blocks = [block('visible', '  one two  ')];
  expect(blocks[0].text.trim().slice(ttsPositionForBlock(blocks, 'visible', 6))).toBe('two');
});

test('speech boundaries retain block identity when background extraction inserts earlier text', () => {
  const spoken = [block('first', 'one two'), block('second', 'three four')];
  const snapshot = spoken.map(item => ({ ...item }));
  spoken.unshift(block('prefetched', 'new earlier text'));
  expect(spokenWordForTtsOffset(snapshot, 9, 5)).toEqual({ blockId: 'second', offset: 0, length: 5 });
  expect(spokenWordForTtsOffset(snapshot, 15, 4)).toEqual({ blockId: 'second', offset: 6, length: 4 });
});
