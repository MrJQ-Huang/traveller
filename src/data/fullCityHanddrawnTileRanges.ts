type TileRange = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export const fullCityHanddrawnTileRanges: Record<number, TileRange[]> = {
  1: [{ minX: 1, maxX: 1, minY: 0, maxY: 0 }],
  2: [{ minX: 3, maxX: 3, minY: 1, maxY: 1 }],
  3: [{ minX: 6, maxX: 6, minY: 3, maxY: 3 }],
  4: [{ minX: 13, maxX: 13, minY: 6, maxY: 6 }],
  5: [{ minX: 26, maxX: 26, minY: 13, maxY: 13 }],
  6: [{ minX: 53, maxX: 53, minY: 26, maxY: 26 }],
  7: [{ minX: 106, maxX: 106, minY: 52, maxY: 52 }],
  8: [{ minX: 213, maxX: 213, minY: 104, maxY: 104 }],
  9: [{ minX: 427, maxX: 427, minY: 208, maxY: 208 }],
  10: [{ minX: 855, maxX: 855, minY: 416, maxY: 417 }],
  11: [{ minX: 1710, maxX: 1711, minY: 833, maxY: 835 }],
  12: [{ minX: 3420, maxX: 3423, minY: 1666, maxY: 1670 }],
  13: [{ minX: 6840, maxX: 6847, minY: 3333, maxY: 3340 }],
  14: [{ minX: 13681, maxX: 13694, minY: 6667, maxY: 6681 }],
  15: [{ minX: 27362, maxX: 27389, minY: 13335, maxY: 13363 }],
  16: [{ minX: 54724, maxX: 54778, minY: 26671, maxY: 26727 }],
  17: [{ minX: 109448, maxX: 109557, minY: 53343, maxY: 53454 }],
  18: [{ minX: 218897, maxX: 219115, minY: 106686, maxY: 106908 }],
};

export function hasFullCityHanddrawnTile(z: number, x: number, y: number) {
  return (
    fullCityHanddrawnTileRanges[z]?.some(
      (range) => x >= range.minX && x <= range.maxX && y >= range.minY && y <= range.maxY,
    ) ?? false
  );
}
