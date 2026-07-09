import fs from "node:fs";
import path from "node:path";

const packageRoot = path.resolve("瓦片制作包/changshu-full-city-all-zooms");
const outputRoot = path.join(packageRoot, "amap-source-tiles");
const tileStyle = "8";
const tileSize = 256;
const zooms = Array.from({ length: 18 }, (_, index) => index + 1);
const concurrency = Number(process.env.TILE_EXPORT_CONCURRENCY ?? 24);
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

async function downloadTile(tile, index, attempt = 1) {
  const destination = outputPath(tile);
  ensureDir(path.dirname(destination));

  if (fs.existsSync(destination) && fs.statSync(destination).size > 0) {
    return {
      ...tile,
      path: path.relative(packageRoot, destination).replaceAll("\\", "/"),
      bytes: fs.statSync(destination).size,
      skipped: true,
    };
  }

  const url = tileUrl(tile, index);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("image")) {
      throw new Error(`Non-image response: ${contentType}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destination, bytes);

    return {
      ...tile,
      url,
      path: path.relative(packageRoot, destination).replaceAll("\\", "/"),
      bytes: bytes.length,
      contentType,
      skipped: false,
    };
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      return downloadTile(tile, index, attempt + 1);
    }

    throw new Error(`${tile.key}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runPool(tiles) {
  let cursor = 0;
  let completed = 0;
  let downloaded = 0;
  let skipped = 0;
  let totalBytes = 0;
  const failures = [];

  async function worker(workerIndex) {
    while (cursor < tiles.length) {
      const index = cursor;
      cursor += 1;
      const tile = tiles[index];

      try {
        const result = await downloadTile(tile, index);
        completed += 1;
        totalBytes += result.bytes;
        if (result.skipped) {
          skipped += 1;
        } else {
          downloaded += 1;
        }

        if (completed === 1 || completed % 250 === 0 || completed === tiles.length) {
          console.log(
            `[${completed}/${tiles.length}] downloaded=${downloaded} skipped=${skipped} last=${tile.key} worker=${workerIndex}`,
          );
        }
      } catch (error) {
        completed += 1;
        failures.push(error instanceof Error ? error.message : String(error));
        console.error(`[FAILED ${completed}/${tiles.length}] ${tile.key}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, (_, index) => worker(index + 1)),
  );

  return { downloaded, skipped, totalBytes, failures };
}

const tiles = buildTiles();
ensureDir(outputRoot);

fs.writeFileSync(path.join(packageRoot, "manifest.json"), `${JSON.stringify({
  styleId: "changshu-full-city-all-zooms",
  tileSize,
  minZoom: Math.min(...zooms),
  maxZoom: Math.max(...zooms),
  bounds,
  concurrency,
  outputTarget: "瓦片制作包/changshu-full-city-all-zooms/amap-source-tiles/{z}/{x}/{y}.png",
  tiles: tiles.map((tile) => ({
    ...tile,
    targetPath: `瓦片制作包/changshu-full-city-all-zooms/amap-source-tiles/${tile.key}.png`,
  })),
}, null, 2)}\n`, "utf8");

console.log(`Preparing to export ${tiles.length} tiles to ${outputRoot}`);
console.log(`Zooms: ${zooms[0]}-${zooms.at(-1)}, concurrency=${concurrency}`);

const startedAt = new Date().toISOString();
const result = await runPool(tiles);
const finishedAt = new Date().toISOString();

const summary = {
  source: "Authorized AMap web tile export",
  scope: "Changshu full map viewport used by the current demo boundary",
  style: tileStyle,
  tileSize,
  bounds,
  zooms,
  count: tiles.length,
  downloaded: result.downloaded,
  skipped: result.skipped,
  failures: result.failures,
  totalBytes: result.totalBytes,
  outputRoot: path.relative(process.cwd(), outputRoot).replaceAll("\\", "/"),
  startedAt,
  finishedAt,
};

fs.writeFileSync(
  path.join(packageRoot, "amap-source-tiles-manifest.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outputRoot, "README.md"),
  `# Changshu Full City All-Zoom Authorized AMap Source Tiles

These files cover the current demo's Changshu full-map boundary viewport.

- Tile count: ${summary.count}
- Tile size: ${tileSize}x${tileSize}
- Style: AMap style=${tileStyle}
- Zooms: ${zooms.join(", ")}
- Bounds: west ${bounds.west}, east ${bounds.east}, south ${bounds.south}, north ${bounds.north}
- Directory format: {z}/{x}/{y}.png
- Downloaded this run: ${summary.downloaded}
- Skipped existing this run: ${summary.skipped}
- Failures: ${summary.failures.length}

This script is resumable. Re-run it and existing non-empty files will be skipped.
Keep the same z/x/y file names when producing stylized tiles.
`,
  "utf8",
);

if (result.failures.length > 0) {
  console.error(`Finished with ${result.failures.length} failures.`);
  process.exitCode = 1;
} else {
  console.log(`Exported ${tiles.length} authorized AMap tiles to ${outputRoot}`);
}
