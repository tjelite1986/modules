const fs = require('fs');
const path = require('path');
const convert = require('heic-convert');

function isHeic(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.heic' || ext === '.heif';
}

// Converts HEIC/HEIF to JPEG. The original file is replaced with the .jpg version.
async function convertHeicIfNeeded(filePath) {
  const filename = path.basename(filePath);
  if (!isHeic(filename)) {
    const ext = path.extname(filename).slice(1).toLowerCase();
    return { path: filePath, filename, ext, converted: false };
  }
  const buffer = fs.readFileSync(filePath);
  const jpegBuffer = await convert({ buffer, format: 'JPEG', quality: 0.9 });
  const dot = filePath.lastIndexOf('.');
  const newPath = filePath.slice(0, dot) + '.jpg';
  fs.writeFileSync(newPath, Buffer.from(jpegBuffer));
  if (newPath !== filePath) {
    try { fs.unlinkSync(filePath); } catch {}
  }
  return { path: newPath, filename: path.basename(newPath), ext: 'jpg', converted: true };
}

module.exports = { convertHeicIfNeeded, isHeic };
