import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// iOS "Add to Home Screen" ignores the SVG favicon and needs a PNG
// apple-touch-icon; without one the home screen shows a gray letter.
describe('home screen icon', () => {
  const root = resolve(__dirname, '..');
  const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8');

  it('is linked from index.html under the app base path', () => {
    expect(indexHtml).toMatch(
      /<link rel="apple-touch-icon" href="\/split-transactions\/apple-touch-icon\.png"/
    );
  });

  it('is a 180x180 PNG in public/', () => {
    const png = readFileSync(resolve(root, 'public/apple-touch-icon.png'));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    // IHDR width and height (big-endian) follow the signature and chunk header
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });
});
