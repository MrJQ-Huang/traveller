import fs from "node:fs";
import path from "node:path";

const packageRoot = path.resolve("瓦片制作包/changshu-demo");
const manifestPath = path.join(packageRoot, "manifest.json");
const outputRoot = path.join(packageRoot, "amap-source-tiles");
const tileStyle = "8";
const tileHosts = [
  "https://webrd01.is.autonavi.com/appmaptile",
  "https://webrd02.is.autonavi.com/appmaptile",
  "https://webrd03.is.autonavi.com/appmaptile",
  "https://webrd04.is.autonavi.com/appmaptile",
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function tileUrl(tile, index) {
  const host = tileHosts[index % tileHosts.length];
  const params = new URLSearchParams({
    lang: "zh_cn",
    size: "1",
    scale: "1",
    style: tileStyle,
    x: String(tile.x),
    y: String(tile.y),
    z: String(tile.z),
  });
  return `${host}?${params.toString()}`;
}

function outputPath(tile) {
  return path.join(outputRoot, String(tile.z), String(tile.x), `${tile.y}.png`);
}

async function downloadTile(tile, index) {
  const url = tileUrl(tile, index);
  const destination = outputPath(tile);
  ensureDir(path.dirname(destination));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${tile.key}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("image")) {
    throw new Error(`Non-image response for ${tile.key}: ${contentType}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, bytes);
  return {
    key: tile.key,
    url,
    path: path.relative(packageRoot, destination).replaceAll("\\", "/"),
    bytes: bytes.length,
    contentType,
  };
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
fs.rmSync(outputRoot, { recursive: true, force: true });
ensureDir(outputRoot);

const results = [];
for (let index = 0; index < manifest.tiles.length; index += 1) {
  const tile = manifest.tiles[index];
  const result = await downloadTile(tile, index);
  results.push(result);
  console.log(`[${index + 1}/${manifest.tiles.length}] ${result.key} ${result.bytes} bytes`);
}

const summary = {
  source: "Authorized AMap web tile export",
  style: tileStyle,
  tileSize: 256,
  count: results.length,
  totalBytes: results.reduce((sum, result) => sum + result.bytes, 0),
  outputRoot: path.relative(process.cwd(), outputRoot).replaceAll("\\", "/"),
  results,
};

fs.writeFileSync(
  path.join(packageRoot, "amap-source-tiles-manifest.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

fs.writeFileSync(
  path.join(outputRoot, "README.md"),
  `# Authorized AMap Source Tiles

These files are exported according to the tile list in ../manifest.json.

- Tile count: ${summary.count}
- Tile size: 256x256
- Style: AMap style=${tileStyle}
- Directory format: {z}/{x}/{y}.png

Use these files as the base/reference tiles for the AI stylization workflow.
Put the final stylized files into:

\`\`\`text
public/map-tiles/changshu-demo/{z}/{x}/{y}.png
\`\`\`

Keep the same z/x/y file names.
`,
  "utf8",
);

console.log(`Exported ${results.length} authorized AMap tiles to ${outputRoot}`);
