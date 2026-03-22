import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(webRoot, "public", "LogoPwa.png");
const iconsDir = path.join(webRoot, "public", "icons");
const manifestPath = path.join(webRoot, "public", "manifest.webmanifest");
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const iconBackground = { r: 247, g: 249, b: 255, alpha: 1 };
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
      background: iconBackground,
    },
  })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png()
    .toFile(destination);
}

function versionedAsset(assetPath) {
  return `${assetPath}?v=${encodeURIComponent(appVersion)}`;
}

async function writeManifest() {
  const manifest = {
    id: "/",
    name: "GB-AI",
    short_name: "GB-AI",
    description: "GB-focused AI hub with chat, local weather, and local news widgets",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: versionedAsset("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: versionedAsset("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: versionedAsset("/icons/icon-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Hub",
        short_name: "Hub",
        url: "/",
      },
      {
        name: "Chat",
        short_name: "Chat",
        url: "/chat",
      },
      {
        name: "Widgets",
        short_name: "Widgets",
        url: "/widgets",
      },
    ],
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function main() {
  await fs.access(sourcePath);
  await fs.mkdir(iconsDir, { recursive: true });

  for (const target of targets) {
    const outputPath = path.join(iconsDir, target.file);
    await generateIcon(target.size, outputPath);
    console.log(`Generated ${target.file}`);
  }

  await writeManifest();
  console.log("Generated manifest.webmanifest");
}

main().catch((error) => {
  console.error("Failed to generate PWA icons:", error);
  process.exit(1);
});
