import {PNG} from './png.js';

const input = /** @type {(HTMLInputElement | null)} */ (
  document.getElementById('image-picker')
);
if (!input) throw new Error('Missing image picker input');

const output = document.getElementById('text-record');
if (!output) throw new Error('Missing text record output');

input.addEventListener('change', async () => {
  if (!input.files) return;

  const [file] = input.files;
  const buffer = await file.arrayBuffer();
  const image = new PNG(buffer);
  output.textContent = JSON.stringify(image.textRecord, null, 2);
});
