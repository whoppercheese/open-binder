import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const sourceSvg = join(publicDir, "icon.svg");

const outputs = [
  { file: "favicon-32x32.png", size: 32 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];

const svg = readFileSync(sourceSvg);

for (const { file, size } of outputs) {
  await sharp(svg, { density: size * 4 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, file));

  console.log(`[generate-icons] public/${file} (${size}x${size})`);
}
