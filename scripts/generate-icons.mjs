import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const source = resolve("public/onevault.svg");
const svg = await readFile(source);

for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(resolve(`public/onevault-${size}.png`));
}

console.log("Generated OneVault PWA icons.");
