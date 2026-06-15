// Generate DropWatch app icons: a radar/scope mark in the brand teal on the
// HUD-dark background, matching the landing + OG image.
//   node scripts/make-icons.mjs
// Writes: app/icon.svg (vector favicon), app/favicon.ico (32px), app/apple-icon.png (180px).
// Next.js App Router auto-links all three via the file conventions.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#05090a"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#34d3a8" stroke-opacity=".32" stroke-width="3"/>
  <circle cx="32" cy="32" r="11.5" fill="none" stroke="#34d3a8" stroke-opacity=".55" stroke-width="3"/>
  <line x1="32" y1="32" x2="49.5" y2="19.5" stroke="#5cf2c4" stroke-width="3.6" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="3.6" fill="#5cf2c4"/>
  <circle cx="45.5" cy="44.5" r="3.4" fill="#f5b942"/>
</svg>`;

// 1) Vector favicon (modern browsers).
writeFileSync(resolve(root, "app/icon.svg"), SVG);

// 2) favicon.ico — a single 32x32 PNG wrapped in an ICO container (PNG-in-ICO).
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const dir = Buffer.alloc(16);
  dir.writeUInt8(size >= 256 ? 0 : size, 0); // width
  dir.writeUInt8(size >= 256 ? 0 : size, 1); // height
  dir.writeUInt8(0, 2); // palette
  dir.writeUInt8(0, 3); // reserved
  dir.writeUInt16LE(1, 4); // color planes
  dir.writeUInt16LE(32, 6); // bits per pixel
  dir.writeUInt32LE(png.length, 8); // size of PNG data
  dir.writeUInt32LE(22, 12); // offset to PNG data
  return Buffer.concat([header, dir, png]);
}
const png32 = await sharp(Buffer.from(SVG), { density: 384 }).resize(32, 32).png().toBuffer();
writeFileSync(resolve(root, "app/favicon.ico"), pngToIco(png32, 32));

// 3) Apple touch icon.
await sharp(Buffer.from(SVG), { density: 384 })
  .resize(180, 180)
  .png()
  .toFile(resolve(root, "app/apple-icon.png"));

console.log("icons written: app/icon.svg, app/favicon.ico (32), app/apple-icon.png (180)");
