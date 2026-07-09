from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from style_tiles_prototype import TILE_SIZE, save_rgb, stylize_metatile


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "amap-source-tiles"
OUT_ROOT = ROOT / "stylized-tiles" / "handdrawn"
QA_ROOT = ROOT / "qa" / "handdrawn"


def discover_tiles() -> dict[tuple[int, int, int], Path]:
    tiles: dict[tuple[int, int, int], Path] = {}
    for path in SOURCE_ROOT.rglob("*.png"):
        rel = path.relative_to(SOURCE_ROOT)
        if len(rel.parts) != 3:
            continue
        z = int(rel.parts[0])
        x = int(rel.parts[1])
        y = int(Path(rel.parts[2]).stem)
        tiles[(z, x, y)] = path
    return tiles


def connected_components(keys: set[tuple[int, int, int]]) -> list[list[tuple[int, int, int]]]:
    remaining = set(keys)
    components: list[list[tuple[int, int, int]]] = []
    while remaining:
        start = remaining.pop()
        q: deque[tuple[int, int, int]] = deque([start])
        component = [start]
        while q:
            z, x, y = q.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                neighbor = (z, nx, ny)
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    q.append(neighbor)
                    component.append(neighbor)
        components.append(sorted(component))
    return sorted(components, key=lambda items: (items[0][0], min(k[1] for k in items), min(k[2] for k in items)))


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def build_mosaic(component: list[tuple[int, int, int]], tile_paths: dict[tuple[int, int, int], Path]) -> tuple[np.ndarray, dict[str, int]]:
    z_values = {z for z, _, _ in component}
    if len(z_values) != 1:
        raise ValueError("A component cannot span multiple zoom levels.")
    z = next(iter(z_values))
    xs = [x for _, x, _ in component]
    ys = [y for _, _, y in component]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    width_tiles = max_x - min_x + 1
    height_tiles = max_y - min_y + 1
    mosaic = np.zeros((height_tiles * TILE_SIZE, width_tiles * TILE_SIZE, 3), dtype=np.uint8)

    # Missing tiles should not occur for the current package components. If a
    # future component has a hole, use a warm paper blank rather than inventing
    # map details.
    mosaic[:, :] = np.array([246, 237, 216], dtype=np.uint8)
    for key in component:
        _, x, y = key
        col = x - min_x
        row = y - min_y
        tile = load_rgb(tile_paths[key])
        y0 = row * TILE_SIZE
        x0 = col * TILE_SIZE
        mosaic[y0 : y0 + TILE_SIZE, x0 : x0 + TILE_SIZE] = tile

    meta = {
        "z": z,
        "minX": min_x,
        "maxX": max_x,
        "minY": min_y,
        "maxY": max_y,
        "widthTiles": width_tiles,
        "heightTiles": height_tiles,
        "tileCount": len(component),
    }
    return mosaic, meta


def save_component_tiles(stylized: np.ndarray, component: list[tuple[int, int, int]], meta: dict[str, int]) -> None:
    for z, x, y in component:
        col = x - meta["minX"]
        row = y - meta["minY"]
        x0 = col * TILE_SIZE
        y0 = row * TILE_SIZE
        tile = stylized[y0 : y0 + TILE_SIZE, x0 : x0 + TILE_SIZE]
        save_rgb(OUT_ROOT / str(z) / str(x) / f"{y}.png", tile)


def make_component_sheet(source: np.ndarray, stylized: np.ndarray, name: str) -> None:
    height, width = source.shape[:2]
    gap = 24
    sheet = Image.new("RGB", (width * 2 + gap, height + 46), (246, 237, 216))
    sheet.paste(Image.fromarray(source), (0, 34))
    sheet.paste(Image.fromarray(stylized), (width + gap, 34))
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 8), f"{name} source", fill=(30, 44, 42))
    draw.text((width + gap + 8, 8), f"{name} handdrawn", fill=(30, 44, 42))
    sheet.save(QA_ROOT / f"{name}.png")


def report_edges(tile_keys: set[tuple[int, int, int]]) -> list[dict[str, object]]:
    reports: list[dict[str, object]] = []
    for z, x, y in sorted(tile_keys):
        for dx, dy, edge in ((1, 0, "right-left"), (0, 1, "bottom-top")):
            other = (z, x + dx, y + dy)
            if other not in tile_keys:
                continue
            a = load_rgb(OUT_ROOT / str(z) / str(x) / f"{y}.png")
            b = load_rgb(OUT_ROOT / str(z) / str(x + dx) / f"{y + dy}.png")
            if edge == "right-left":
                diff = np.abs(a[:, -1].astype(np.int16) - b[:, 0].astype(np.int16))
            else:
                diff = np.abs(a[-1, :].astype(np.int16) - b[0, :].astype(np.int16))
            reports.append(
                {
                    "edge": edge,
                    "tileA": f"{z}/{x}/{y}",
                    "tileB": f"{z}/{x + dx}/{y + dy}",
                    "meanAbsDiff": round(float(diff.mean()), 3),
                    "maxAbsDiff": int(diff.max()),
                }
            )
    return reports


def main() -> None:
    tile_paths = discover_tiles()
    components = connected_components(set(tile_paths.keys()))
    QA_ROOT.mkdir(parents=True, exist_ok=True)

    component_reports: list[dict[str, object]] = []
    for index, component in enumerate(components, start=1):
        source, meta = build_mosaic(component, tile_paths)
        stylized = stylize_metatile(source, "handdrawn")
        save_component_tiles(stylized, component, meta)
        name = f"z{meta['z']}-component-{index}-x{meta['minX']}-{meta['maxX']}-y{meta['minY']}-{meta['maxY']}"
        make_component_sheet(source, stylized, name)
        component_reports.append(
            {
                "name": name,
                **meta,
                "sourceSize": [int(source.shape[1]), int(source.shape[0])],
                "outputSheet": str((QA_ROOT / f"{name}.png").relative_to(ROOT)),
            }
        )

    output_files = sorted(OUT_ROOT.rglob("*.png"))
    report = {
        "preset": "handdrawn",
        "sourceRoot": str(SOURCE_ROOT.relative_to(ROOT)),
        "outputRoot": str(OUT_ROOT.relative_to(ROOT)),
        "qaRoot": str(QA_ROOT.relative_to(ROOT)),
        "tileSize": TILE_SIZE,
        "sourceTileCount": len(tile_paths),
        "outputTileCount": len(output_files),
        "components": component_reports,
        "edgeContinuity": report_edges(set(tile_paths.keys())),
    }
    (QA_ROOT / "full-handdrawn-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
