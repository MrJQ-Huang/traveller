from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

from style_tiles_prototype import TILE_SIZE, save_rgb, stylize_metatile


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "amap-source-tiles"
OUT_ROOT = ROOT / "stylized-tiles" / "handdrawn"
QA_ROOT = ROOT / "qa" / "handdrawn"
REPORT_PATH = QA_ROOT / "chunked-handdrawn-report.json"

DEFAULT_CHUNK_TILES = 16
DEFAULT_HALO_TILES = 1
DEFAULT_MIN_FREE_GB = 5.0


def free_gb() -> float:
    return shutil.disk_usage(ROOT.anchor).free / (1024 ** 3)


def discover_tiles() -> dict[int, dict[tuple[int, int], Path]]:
    tiles: dict[int, dict[tuple[int, int], Path]] = {}
    for path in SOURCE_ROOT.rglob("*.png"):
        rel = path.relative_to(SOURCE_ROOT)
        if len(rel.parts) != 3:
            continue
        z = int(rel.parts[0])
        x = int(rel.parts[1])
        y = int(Path(rel.parts[2]).stem)
        tiles.setdefault(z, {})[(x, y)] = path
    return tiles


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def output_path(z: int, x: int, y: int) -> Path:
    return OUT_ROOT / str(z) / str(x) / f"{y}.png"


def chunk_ranges(values: list[int], chunk_size: int) -> list[tuple[int, int]]:
    if not values:
        return []
    min_value = min(values)
    max_value = max(values)
    ranges: list[tuple[int, int]] = []
    start = min_value
    while start <= max_value:
        end = min(start + chunk_size - 1, max_value)
        ranges.append((start, end))
        start = end + 1
    return ranges


def build_chunk(
    z: int,
    tile_paths: dict[tuple[int, int], Path],
    save_x0: int,
    save_x1: int,
    save_y0: int,
    save_y1: int,
    halo_tiles: int,
) -> tuple[np.ndarray, dict[str, int]]:
    xs = [x for x, _ in tile_paths]
    ys = [y for _, y in tile_paths]
    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)

    read_x0 = max(min_x, save_x0 - halo_tiles)
    read_x1 = min(max_x, save_x1 + halo_tiles)
    read_y0 = max(min_y, save_y0 - halo_tiles)
    read_y1 = min(max_y, save_y1 + halo_tiles)
    width_tiles = read_x1 - read_x0 + 1
    height_tiles = read_y1 - read_y0 + 1

    mosaic = np.zeros((height_tiles * TILE_SIZE, width_tiles * TILE_SIZE, 3), dtype=np.uint8)
    mosaic[:, :] = np.array([246, 237, 216], dtype=np.uint8)

    for y in range(read_y0, read_y1 + 1):
        for x in range(read_x0, read_x1 + 1):
            path = tile_paths.get((x, y))
            if path is None:
                continue
            col = x - read_x0
            row = y - read_y0
            x_px = col * TILE_SIZE
            y_px = row * TILE_SIZE
            mosaic[y_px : y_px + TILE_SIZE, x_px : x_px + TILE_SIZE] = load_rgb(path)

    meta = {
        "z": z,
        "saveX0": save_x0,
        "saveX1": save_x1,
        "saveY0": save_y0,
        "saveY1": save_y1,
        "readX0": read_x0,
        "readX1": read_x1,
        "readY0": read_y0,
        "readY1": read_y1,
        "widthTiles": width_tiles,
        "heightTiles": height_tiles,
    }
    return mosaic, meta


def save_chunk_tiles(
    stylized: np.ndarray,
    tile_paths: dict[tuple[int, int], Path],
    meta: dict[str, int],
    overwrite: bool,
) -> int:
    saved = 0
    z = meta["z"]
    for y in range(meta["saveY0"], meta["saveY1"] + 1):
        for x in range(meta["saveX0"], meta["saveX1"] + 1):
            if (x, y) not in tile_paths:
                continue
            out_path = output_path(z, x, y)
            if out_path.exists() and out_path.stat().st_size > 0 and not overwrite:
                continue

            col = x - meta["readX0"]
            row = y - meta["readY0"]
            x_px = col * TILE_SIZE
            y_px = row * TILE_SIZE
            tile = stylized[y_px : y_px + TILE_SIZE, x_px : x_px + TILE_SIZE]
            save_rgb(out_path, tile)
            saved += 1
    return saved


def write_report(report: dict[str, object]) -> None:
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Chunked full-city handdrawn tile stylizer.")
    parser.add_argument("--chunk-tiles", type=int, default=DEFAULT_CHUNK_TILES)
    parser.add_argument("--halo-tiles", type=int, default=DEFAULT_HALO_TILES)
    parser.add_argument("--min-free-gb", type=float, default=DEFAULT_MIN_FREE_GB)
    parser.add_argument("--max-tiles", type=int, default=0, help="Optional smoke-test limit.")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    if args.chunk_tiles < 1:
        raise ValueError("--chunk-tiles must be >= 1")
    if args.halo_tiles < 0:
        raise ValueError("--halo-tiles must be >= 0")

    start_time = time.time()
    tiles_by_zoom = discover_tiles()
    source_count = sum(len(items) for items in tiles_by_zoom.values())
    if source_count == 0:
        print(f"[ERROR] No source tiles found under {SOURCE_ROOT}", file=sys.stderr)
        return 1

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    QA_ROOT.mkdir(parents=True, exist_ok=True)

    report: dict[str, object] = {
        "preset": "handdrawn",
        "mode": "chunked",
        "sourceRoot": str(SOURCE_ROOT.relative_to(ROOT)),
        "outputRoot": str(OUT_ROOT.relative_to(ROOT)),
        "tileSize": TILE_SIZE,
        "chunkTiles": args.chunk_tiles,
        "haloTiles": args.halo_tiles,
        "minFreeGb": args.min_free_gb,
        "sourceTileCount": source_count,
        "savedTileCount": 0,
        "skippedExistingCount": 0,
        "processedChunkCount": 0,
        "startedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        "freeGbAtStart": round(free_gb(), 3),
        "zooms": {},
        "stopped": None,
    }
    write_report(report)

    saved_total = 0
    skipped_existing_total = 0
    processed_chunks = 0

    print(
        f"[START] source={source_count} chunk={args.chunk_tiles} halo={args.halo_tiles} "
        f"free={free_gb():.2f}GB"
    )

    for z in sorted(tiles_by_zoom):
        tile_paths = tiles_by_zoom[z]
        xs = sorted({x for x, _ in tile_paths})
        ys = sorted({y for _, y in tile_paths})
        zoom_saved = 0
        zoom_skipped = 0
        zoom_chunks = 0
        zoom_info = {
            "tileCount": len(tile_paths),
            "minX": min(xs),
            "maxX": max(xs),
            "minY": min(ys),
            "maxY": max(ys),
            "savedTileCount": 0,
            "skippedExistingCount": 0,
            "chunkCount": 0,
        }
        report["zooms"][str(z)] = zoom_info  # type: ignore[index]

        x_ranges = chunk_ranges(xs, args.chunk_tiles)
        y_ranges = chunk_ranges(ys, args.chunk_tiles)
        print(
            f"[ZOOM] z{z} tiles={len(tile_paths)} range=x{min(xs)}-{max(xs)} "
            f"y{min(ys)}-{max(ys)} chunks={len(x_ranges) * len(y_ranges)}"
        )

        for save_y0, save_y1 in y_ranges:
            for save_x0, save_x1 in x_ranges:
                keys = [
                    (x, y)
                    for y in range(save_y0, save_y1 + 1)
                    for x in range(save_x0, save_x1 + 1)
                    if (x, y) in tile_paths
                ]
                if not keys:
                    continue

                existing = [
                    key
                    for key in keys
                    if output_path(z, key[0], key[1]).exists()
                    and output_path(z, key[0], key[1]).stat().st_size > 0
                ]
                if len(existing) == len(keys) and not args.overwrite:
                    zoom_skipped += len(existing)
                    skipped_existing_total += len(existing)
                    continue

                current_free = free_gb()
                if current_free < args.min_free_gb:
                    report["stopped"] = {
                        "reason": "low_disk_space",
                        "freeGb": round(current_free, 3),
                        "thresholdGb": args.min_free_gb,
                    }
                    write_report(report)
                    print(
                        f"[STOP] free disk {current_free:.2f}GB is below threshold "
                        f"{args.min_free_gb:.2f}GB"
                    )
                    return 2

                source, meta = build_chunk(
                    z,
                    tile_paths,
                    save_x0,
                    save_x1,
                    save_y0,
                    save_y1,
                    args.halo_tiles,
                )
                stylized = stylize_metatile(source, "handdrawn")
                saved = save_chunk_tiles(stylized, tile_paths, meta, args.overwrite)
                saved_total += saved
                zoom_saved += saved
                processed_chunks += 1
                zoom_chunks += 1

                report["savedTileCount"] = saved_total
                report["skippedExistingCount"] = skipped_existing_total
                report["processedChunkCount"] = processed_chunks
                zoom_info["savedTileCount"] = zoom_saved
                zoom_info["skippedExistingCount"] = zoom_skipped
                zoom_info["chunkCount"] = zoom_chunks
                report["freeGbLatest"] = round(free_gb(), 3)
                report["elapsedSeconds"] = round(time.time() - start_time, 1)

                if processed_chunks % 10 == 0 or saved_total == source_count:
                    write_report(report)
                    print(
                        f"[PROGRESS] chunks={processed_chunks} saved={saved_total} "
                        f"skipped={skipped_existing_total} free={free_gb():.2f}GB"
                    )

                if args.max_tiles and saved_total >= args.max_tiles:
                    report["stopped"] = {"reason": "max_tiles", "maxTiles": args.max_tiles}
                    write_report(report)
                    print(f"[STOP] smoke-test limit reached: {args.max_tiles}")
                    return 0

        write_report(report)

    report["finishedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
    report["elapsedSeconds"] = round(time.time() - start_time, 1)
    report["freeGbAtEnd"] = round(free_gb(), 3)
    report["outputTileCount"] = len(list(OUT_ROOT.rglob("*.png")))
    write_report(report)
    print(
        f"[DONE] saved={saved_total} skipped={skipped_existing_total} "
        f"output={report['outputTileCount']} free={free_gb():.2f}GB"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
