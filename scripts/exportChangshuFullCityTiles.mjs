import fs from "node:fs";
import path from "node:path";

const packageRoot = path.resolve("瓦片制作包/changshu-full-city");
const outputRoot = path.join(packageRoot, "amap-source-tiles");
const tileStyle = "8";
const tileSize = 256;
const zooms = [12, 13, 14];
const bounds = {
  west: 120.61,
  east: 120.91,
  south: 31.47,
  north: 31.73,
};
const tileHosts = [
  "https://webrd01.is.autonavi.com/appmaptile",
  "https://webrd02.is.autonavi.com/appmaptile",
  "https://webrd03.is.autonavi.com/appmaptile",
  "https://webrd04.is.autonavi.com/appmaptile",
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function lonToTileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

function tileXToLon(x, z) {
  return (x / 2 ** z) * 360 - 180;
}

function tileYToLat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function buildTiles() {
  return zooms.flatMap((z) => {
    const minX = lonToTileX(bounds.west, z);
    const maxX = lonToTileX(bounds.east, z);
    const minY = latToTileY(bounds.north, z);
    const maxY = latToTileY(bounds.south, z);
    const tiles = [];

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        tiles.push({
          z,
          x,
          y,
          key: `${z}/${x}/${y}`,
          bounds: {
            west: tileXToLon(x, z),
            east: tileXToLon(x + 1, z),
            north: tileYToLat(y, z),
            south: tileYToLat(y + 1, z),
          },
        });
      }
    }

    return tiles;
  });
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
    ...tile,
    url,
    path: path.relative(packageRoot, destination).replaceAll("\\", "/"),
    bytes: bytes.length,
    contentType,
  };
}

const tiles = buildTiles();

fs.rmSync(outputRoot, { recursive: true, force: true });
ensureDir(outputRoot);

const results = [];
for (let index = 0; index < tiles.length; index += 1) {
  const result = await downloadTile(tiles[index], index);
  results.push(result);
  console.log(`[${index + 1}/${tiles.length}] ${result.key} ${result.bytes} bytes`);
}

const summary = {
  source: "Authorized AMap web tile export",
  scope: "Changshu full map viewport used by the current demo boundary",
  style: tileStyle,
  tileSize,
  bounds,
  zooms,
  count: results.length,
  totalBytes: results.reduce((sum, result) => sum + result.bytes, 0),
  outputRoot: path.relative(process.cwd(), outputRoot).replaceAll("\\", "/"),
  results,
};

ensureDir(packageRoot);
fs.writeFileSync(path.join(packageRoot, "manifest.json"), `${JSON.stringify({
  styleId: "changshu-full-city",
  tileSize,
  minZoom: Math.min(...zooms),
  maxZoom: Math.max(...zooms),
  bounds,
  outputTarget: "瓦片制作包/changshu-full-city/amap-source-tiles/{z}/{x}/{y}.png",
  tiles: tiles.map((tile) => ({
    ...tile,
    targetPath: `瓦片制作包/changshu-full-city/amap-source-tiles/${tile.key}.png`,
  })),
}, null, 2)}\n`, "utf8");
fs.writeFileSync(
  path.join(packageRoot, "amap-source-tiles-manifest.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outputRoot, "README.md"),
  `# Changshu Full City Authorized AMap Source Tiles

These files cover the current demo's Changshu full-map boundary viewport.

- Tile count: ${summary.count}
- Tile size: ${tileSize}x${tileSize}
- Style: AMap style=${tileStyle}
- Zooms: ${zooms.join(", ")}
- Bounds: west ${bounds.west}, east ${bounds.east}, south ${bounds.south}, north ${bounds.north}
- Directory format: {z}/{x}/{y}.png

Use these files as source/reference tiles for the AI stylization workflow.
Keep the same z/x/y file names when producing stylized tiles.
`,
  "utf8",
);

console.log(`Exported ${results.length} authorized AMap tiles to ${outputRoot}`);
