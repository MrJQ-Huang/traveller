from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "amap-source-tiles"
OUT_ROOT = ROOT / "stylized-tiles-prototype"
QA_ROOT = ROOT / "prototype"

ZOOM = 14
X_RANGE = range(13683, 13686)
Y_RANGE = range(6671, 6674)
TILE_SIZE = 256


def read_tile(z: int, x: int, y: int) -> np.ndarray:
    path = SOURCE_ROOT / str(z) / str(x) / f"{y}.png"
    return np.array(Image.open(path).convert("RGB"))


def save_rgb(path: Path, array: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), "RGB").save(path)


def colorize_region(rgb: np.ndarray, mask: np.ndarray, target: tuple[int, int, int], strength: float) -> np.ndarray:
    out = rgb.astype(np.float32)
    target_arr = np.array(target, dtype=np.float32)
    out[mask] = out[mask] * (1.0 - strength) + target_arr * strength
    return out


def make_paper_texture(height: int, width: int, seed: int = 12066) -> np.ndarray:
    rng = np.random.default_rng(seed)
    fine = rng.normal(0, 1.0, (height, width)).astype(np.float32)
    coarse = rng.normal(0, 1.0, (max(8, height // 8), max(8, width // 8))).astype(np.float32)
    coarse = cv2.resize(coarse, (width, height), interpolation=cv2.INTER_CUBIC)
    fine = cv2.GaussianBlur(fine, (0, 0), 0.7)
    coarse = cv2.GaussianBlur(coarse, (0, 0), 5.5)
    texture = fine * 2.3 + coarse * 5.4
    return texture[..., None]


def stylize_metatile(rgb: np.ndarray, preset: str) -> np.ndarray:
    if preset == "handdrawn":
        land_strength = 0.80
        water_strength = 0.72
        green_strength = 0.73
        road_strength = 0.82
        minor_road_strength = 0.46
        texture_strength = 1.85
        edge_strength = 0.48
        paper_strength = 0.16
        contrast = 1.075
        detail_dark_mix = 0.36
        smooth_sigma_color = 24
    elif preset == "vivid":
        land_strength = 0.72
        water_strength = 0.62
        green_strength = 0.62
        road_strength = 0.64
        minor_road_strength = 0.32
        texture_strength = 1.35
        edge_strength = 0.36
        paper_strength = 0.10
        contrast = 1.055
        detail_dark_mix = 0.26
        smooth_sigma_color = 18
    else:
        land_strength = 0.58
        water_strength = 0.46
        green_strength = 0.48
        road_strength = 0.47
        minor_road_strength = 0.32
        texture_strength = 1.0
        edge_strength = 0.28
        paper_strength = 0.06
        contrast = 1.035
        detail_dark_mix = 0.26
        smooth_sigma_color = 18

    base = rgb.astype(np.float32)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    r, g, b = base[..., 0], base[..., 1], base[..., 2]

    # High-confidence semantic masks from the Gaode palette. These masks avoid
    # generative redraw and only recolor existing pixels.
    water = (b > 165) & (g > 145) & (r < 225) & (b > r + 18)
    green = (g > r + 10) & (g > b + 8) & (g > 145) & (r < 225)
    arterial_road = (r > 210) & (g > 145) & (g < 225) & (b < 135)
    minor_road = (v > 190) & (s < 55) & (np.abs(r - g) < 22) & (np.abs(g - b) < 28)
    pale_land = (v > 220) & (s < 45) & (~water) & (~green) & (~arterial_road)
    dark_detail = gray < 125

    out = base.copy()
    out = colorize_region(out, pale_land, (242, 232, 207), land_strength)
    out = colorize_region(out, water, (66, 139, 158), water_strength)
    out = colorize_region(out, green, (126, 168, 124), green_strength)
    out = colorize_region(out, minor_road, (230, 222, 204), minor_road_strength)
    out = colorize_region(out, arterial_road, (221, 134, 43), road_strength)

    # Slight watercolor pooling: low-frequency chroma variation, but no pixel
    # movement. It is masked to broad surfaces and kept away from dark labels.
    texture = make_paper_texture(rgb.shape[0], rgb.shape[1])
    broad_surface = (pale_land | water | green) & (~dark_detail)
    out[broad_surface] = out[broad_surface] + texture[broad_surface] * np.array([1.0, 0.85, 0.55]) * texture_strength

    if preset == "handdrawn":
        # A second slow wash creates a more visible watercolor bloom without
        # moving map pixels.
        wash = make_paper_texture(rgb.shape[0], rgb.shape[1], seed=31059)
        water_green = (water | green) & (~dark_detail)
        out[water_green] = out[water_green] + wash[water_green] * np.array([0.35, 1.15, 1.25])

    # Paper wash over the entire tile set.
    paper = np.array([246, 237, 216], dtype=np.float32)
    out = out * (1.0 - paper_strength) + paper * paper_strength

    # Ink-like line reinforcement from existing edges only. This keeps geometry
    # locked while giving road/water/building outlines a hand-rendered bite.
    edges = cv2.Canny(gray, 55, 140)
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)
    edge_mask = edges > 0
    ink = np.array([42, 68, 68], dtype=np.float32)
    out[edge_mask] = out[edge_mask] * (1.0 - edge_strength) + ink * edge_strength

    # Preserve text and POI legibility. Dark map text/icons are darkened rather
    # than repainted, preventing Chinese labels from becoming generated text.
    out[dark_detail] = base[dark_detail] * 0.82 + np.array([30, 44, 42], dtype=np.float32) * 0.18

    if preset == "handdrawn":
        # Reference-like readable labels need a halo, but not OCR/retyping.
        # This uses the original dark pixels as a mask, expands around them,
        # and lays a warm paper outline underneath while keeping exact glyphs.
        detail = ((gray < 150) & (v < 210)) | ((s > 70) & (v < 190))
        detail = detail & (~arterial_road)
        detail_u8 = detail.astype(np.uint8) * 255
        halo = cv2.dilate(detail_u8, np.ones((3, 3), np.uint8), iterations=1) > 0
        halo_ring = halo & (~detail)
        halo_color = np.array([248, 241, 221], dtype=np.float32)
        out[halo_ring] = out[halo_ring] * 0.42 + halo_color * 0.58

    # Gentle paper contrast curve.
    out = np.clip((out - 128.0) * contrast + 128.0, 0, 255)
    out = cv2.bilateralFilter(out.astype(np.uint8), d=3, sigmaColor=smooth_sigma_color, sigmaSpace=4).astype(np.float32)

    # Re-apply dark detail after smoothing to keep small labels readable.
    out[dark_detail] = base[dark_detail] * (1.0 - detail_dark_mix) + np.array([24, 36, 35], dtype=np.float32) * detail_dark_mix

    # Sharpen lightly. No warping, no resizing.
    blurred = cv2.GaussianBlur(out, (0, 0), 0.55)
    out = cv2.addWeighted(out, 1.18, blurred, -0.18, 0)
    return np.clip(out, 0, 255).astype(np.uint8)


def build_metatile() -> tuple[np.ndarray, list[dict[str, int]]]:
    xs = list(X_RANGE)
    ys = list(Y_RANGE)
    mosaic = np.zeros((len(ys) * TILE_SIZE, len(xs) * TILE_SIZE, 3), dtype=np.uint8)
    tiles: list[dict[str, int]] = []
    for row, y in enumerate(ys):
        for col, x in enumerate(xs):
            tile = read_tile(ZOOM, x, y)
            y0 = row * TILE_SIZE
            x0 = col * TILE_SIZE
            mosaic[y0 : y0 + TILE_SIZE, x0 : x0 + TILE_SIZE] = tile
            tiles.append({"z": ZOOM, "x": x, "y": y, "row": row, "col": col})
    return mosaic, tiles


def save_tiles(stylized: np.ndarray, tiles: list[dict[str, int]], root: Path) -> None:
    for item in tiles:
        row, col = item["row"], item["col"]
        y0 = row * TILE_SIZE
        x0 = col * TILE_SIZE
        tile = stylized[y0 : y0 + TILE_SIZE, x0 : x0 + TILE_SIZE]
        save_rgb(root / str(item["z"]) / str(item["x"]) / f"{item['y']}.png", tile)


def make_contact_sheet(source: np.ndarray, conservative: np.ndarray, vivid: np.ndarray, handdrawn: np.ndarray) -> None:
    height, width = source.shape[:2]
    gap = 24
    sheet = Image.new("RGB", (width * 4 + gap * 3, height + 46), (246, 237, 216))
    sheet.paste(Image.fromarray(source), (0, 34))
    sheet.paste(Image.fromarray(conservative), (width + gap, 34))
    sheet.paste(Image.fromarray(vivid), (width * 2 + gap * 2, 34))
    sheet.paste(Image.fromarray(handdrawn), (width * 3 + gap * 3, 34))
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 8), "source metatile", fill=(30, 44, 42))
    draw.text((width + gap + 8, 8), "conservative", fill=(30, 44, 42))
    draw.text((width * 2 + gap * 2 + 8, 8), "vivid", fill=(30, 44, 42))
    draw.text((width * 3 + gap * 3 + 8, 8), "handdrawn stronger", fill=(30, 44, 42))
    sheet.save(QA_ROOT / "contact-sheet-z14-13683-13685-6671-6673.png")


def edge_report(source: np.ndarray, stylized: np.ndarray, tiles: list[dict[str, int]]) -> list[dict[str, object]]:
    reports: list[dict[str, object]] = []
    by_xy = {(item["x"], item["y"]): item for item in tiles}

    def crop(arr: np.ndarray, item: dict[str, int]) -> np.ndarray:
        y0 = item["row"] * TILE_SIZE
        x0 = item["col"] * TILE_SIZE
        return arr[y0 : y0 + TILE_SIZE, x0 : x0 + TILE_SIZE]

    for item in tiles:
        x, y = item["x"], item["y"]
        for dx, dy, label in [(1, 0, "right-left"), (0, 1, "bottom-top")]:
            other = by_xy.get((x + dx, y + dy))
            if not other:
                continue
            a = crop(stylized, item)
            b = crop(stylized, other)
            if label == "right-left":
                diff = np.abs(a[:, -1].astype(np.int16) - b[:, 0].astype(np.int16))
            else:
                diff = np.abs(a[-1, :].astype(np.int16) - b[0, :].astype(np.int16))
            reports.append(
                {
                    "edge": label,
                    "tileA": f"{ZOOM}/{x}/{y}",
                    "tileB": f"{ZOOM}/{x + dx}/{y + dy}",
                    "meanAbsDiff": round(float(diff.mean()), 3),
                    "maxAbsDiff": int(diff.max()),
                }
            )
    return reports


def main() -> None:
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    source, tiles = build_metatile()
    conservative = stylize_metatile(source, "conservative")
    vivid = stylize_metatile(source, "vivid")
    handdrawn = stylize_metatile(source, "handdrawn")
    save_rgb(QA_ROOT / "source-metatile-z14-13683-13685-6671-6673.png", source)
    save_rgb(QA_ROOT / "stylized-metatile-conservative-z14-13683-13685-6671-6673.png", conservative)
    save_rgb(QA_ROOT / "stylized-metatile-vivid-z14-13683-13685-6671-6673.png", vivid)
    save_rgb(QA_ROOT / "stylized-metatile-handdrawn-z14-13683-13685-6671-6673.png", handdrawn)
    save_tiles(conservative, tiles, OUT_ROOT / "conservative")
    save_tiles(vivid, tiles, OUT_ROOT / "vivid")
    save_tiles(handdrawn, tiles, OUT_ROOT / "handdrawn")
    make_contact_sheet(source, conservative, vivid, handdrawn)

    report = {
        "prototype": "z14 x=13683..13685 y=6671..6673",
        "tileSize": TILE_SIZE,
        "tileCount": len(tiles),
        "outputs": {
            "stylizedTilesConservative": str((OUT_ROOT / "conservative").relative_to(ROOT)),
            "stylizedTilesVivid": str((OUT_ROOT / "vivid").relative_to(ROOT)),
            "stylizedTilesHanddrawn": str((OUT_ROOT / "handdrawn").relative_to(ROOT)),
            "qa": str(QA_ROOT.relative_to(ROOT)),
        },
        "edgeContinuity": {
            "conservative": edge_report(source, conservative, tiles),
            "vivid": edge_report(source, vivid, tiles),
            "handdrawn": edge_report(source, handdrawn, tiles),
        },
    }
    (QA_ROOT / "prototype-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
