import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(webRoot, "public", "LogoPwa.png");
const iconsDir = path.join(webRoot, "public", "icons");
const brandBackground = { r: 0, g: 36, b: 125, alpha: 1 };
const safeAreaRatio = 0.76;

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

async function generateIcon(size, destination) {
  const innerSize = Math.round(size * safeAreaRatio);

  const logoBuffer = await sharp(sourcePath)
    .resize({
      width: innerSize,
      height: innerSize,
      fit: "contain",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: brandBackground,
    },
  })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png()
    .toFile(destination);
}

async function main() {
  await fs.access(sourcePath);
  await fs.mkdir(iconsDir, { recursive: true });

  for (const target of targets) {
    const outputPath = path.join(iconsDir, target.file);
    await generateIcon(target.size, outputPath);
    console.log(`Generated ${target.file}`);
  }
}

main().catch((error) => {
  console.error("Failed to generate PWA icons:", error);
  process.exit(1);
});
