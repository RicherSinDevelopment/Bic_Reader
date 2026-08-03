const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build');
const destination = path.join(root, 'assets', 'pdfjs');

fs.mkdirSync(destination, { recursive: true });

for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  fs.copyFileSync(
    path.join(source, file),
    path.join(destination, `${file}.bin`),
  );
}

console.log('Prepared offline PDF.js assets.');
