import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "src", "data");

const tieredCsvPath = path.join(dataDir, "all_tiered_dataset.csv");
const fullPoiCsvPath = path.join(dataDir, "full_poi_dataset.csv");
const generatedPlacesPath = path.join(dataDir, "generatedPlaces.ts");
const generatedPoiIndexJsonPath = path.join(dataDir, "generatedPoiIndex.json");
const generatedPoiIndexPath = path.join(dataDir, "generatedPoiIndex.ts");
const generatedMetaPath = path.join(dataDir, "generatedDatasetMeta.ts");

const CHANGSHU_BOUNDS = {
  minLng: 120.55,
  maxLng: 121.05,
  minLat: 31.45,
  maxLat: 31.82,
};

const categoryToType = new Map([
  ["景点", "scenic"],
  ["美食", "food"],
  ["酒店", "lodging"],
  ["医院", "hospital"],
  ["停车场", "parking"],
  ["公安/警务点", "police"],
  ["卫生间", "restroom"],
]);

const categoryToSlug = new Map([
  ["景点", "scenic"],
  ["美食", "food"],
  ["酒店", "lodging"],
  ["医院", "hospital"],
  ["停车场", "parking"],
  ["公安/警务点", "police"],
  ["卫生间", "restroom"],
  ["公交站", "bus-stop"],
  ["充电站", "charging"],
]);

const fallbackImageByType = {
  scenic: "/assets/generated-placeholders/scenic.png",
  heritage: "/assets/generated-placeholders/heritage.png",
  food: "/assets/generated-placeholders/food.png",
  restaurant: "/assets/generated-placeholders/restaurant.png",
  parking: "/assets/generated-placeholders/parking.png",
  restroom: "/assets/generated-placeholders/restroom.png",
  lodging: "/assets/generated-placeholders/lodging.png",
  hospital: "/assets/generated-placeholders/hospital.png",
  police: "/assets/generated-placeholders/police.png",
};

const fallbackImageByCategory = {
  景点: "/assets/generated-placeholders/scenic.png",
  美食: "/assets/generated-placeholders/food.png",
  酒店: "/assets/generated-placeholders/lodging.png",
  医院: "/assets/generated-placeholders/hospital.png",
  停车场: "/assets/generated-placeholders/parking.png",
  "公安/警务点": "/assets/generated-placeholders/police.png",
  卫生间: "/assets/generated-placeholders/restroom.png",
  公交站: "/assets/generated-placeholders/service.png",
  充电站: "/assets/generated-placeholders/parking.png",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((item) => item.length > 0)) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some((item) => item.length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map(cleanCell);
  return rows.slice(1).map((cells) => {
    return header.reduce((record, key, index) => {
      record[key] = cleanCell(cells[index] ?? "");
      return record;
    }, {});
  });
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return parseCsv(text);
}

function cleanCell(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const number = Number.parseFloat(cleanCell(value));
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lngLatToXY(lng, lat) {
  const x = ((lng - CHANGSHU_BOUNDS.minLng) / (CHANGSHU_BOUNDS.maxLng - CHANGSHU_BOUNDS.minLng)) * 100;
  const y = (1 - (lat - CHANGSHU_BOUNDS.minLat) / (CHANGSHU_BOUNDS.maxLat - CHANGSHU_BOUNDS.minLat)) * 100;
  return {
    x: Math.round(clamp(x, 2, 98) * 100) / 100,
    y: Math.round(clamp(y, 2, 98) * 100) / 100,
  };
}

function toIdPart(value) {
  return cleanCell(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makePlaceId(row, type) {
  const category = cleanCell(row["分类"]);
  const slug = categoryToSlug.get(category) ?? type;
  const poiId = toIdPart(row["POI_ID"]);
  const serial = toIdPart(row["全局序号"]);
  return `db-${slug}-${poiId || serial}`;
}

function splitTags(value, extra = []) {
  const tags = cleanCell(value)
    .split(/[、,，/|;\s]+/u)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set([...tags, ...extra.filter(Boolean)])].slice(0, 8);
}

function parseDynamic(dynamicText) {
  const text = cleanCell(dynamicText);
  const avgMatch = text.match(/avg_crowd\s*=\s*([0-9.]+)/i);
  const peakMatch = text.match(/peak_crowd\s*=\s*([0-9.]+)/i);
  return {
    avgCrowd: avgMatch ? Number.parseFloat(avgMatch[1]) : null,
    peakCrowd: peakMatch ? Number.parseFloat(peakMatch[1]) : null,
  };
}

function crowdLevelFrom(row) {
  const { peakCrowd } = parseDynamic(row["动态字段"] ?? row["动态/扩展字段"]);
  if (typeof peakCrowd === "number" && Number.isFinite(peakCrowd)) {
    if (peakCrowd >= 0.75) return "very-high";
    if (peakCrowd >= 0.55) return "high";
    if (peakCrowd >= 0.3) return "medium";
    return "low";
  }

  return "low";
}

function formatDuration(minutesText, type) {
  const minutes = Number.parseInt(cleanCell(minutesText), 10);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    if (type === "lodging") return "过夜";
    if (type === "parking" || type === "restroom" || type === "hospital" || type === "police") return "10 分钟";
    return undefined;
  }
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} 小时` : `${Math.round(hours * 10) / 10} 小时`;
}

function recommendedStayMinutes(row, type) {
  const minutes = Number.parseInt(cleanCell(row["建议游览分钟"] ?? row["建议停留分钟"]), 10);
  if (Number.isFinite(minutes) && minutes > 0) return minutes;
  if (type === "scenic") return 90;
  if (type === "food") return 60;
  if (type === "lodging") return 0;
  if (type === "parking" || type === "restroom" || type === "hospital" || type === "police") return 10;
  return 45;
}

function routeWeightFrom(row) {
  const score = toNumber(row["选择分"]);
  return typeof score === "number" ? Math.round(score * 100) / 100 : 35;
}

function detailFrom(row) {
  return [
    row["开放/服务时间"] ? `开放/服务时间：${row["开放/服务时间"]}` : "",
    row["价格/费用/余量"] ? `价格/费用：${row["价格/费用/余量"]}` : "",
    row["建议游览分钟"] ? `建议停留：${formatDuration(row["建议游览分钟"], "scenic")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function queueTipFrom(crowdLevel) {
  if (crowdLevel === "very-high") return "建议错峰或提前电话确认。";
  if (crowdLevel === "high") return "高峰可能排队，建议提前规划。";
  if (crowdLevel === "medium") return "常规热度，适合顺路安排。";
  return "相对舒适，适合临时加入。";
}

function serviceProfileFrom(row, type, category) {
  const price = cleanCell(row["价格/费用/余量"]);
  const dynamicText = cleanCell(row["动态字段"]);
  const subtype = cleanCell(row["子类"]);

  if (type === "parking") {
    return {
      status: dynamicText || "停车服务点，余位和收费以后端实时接口为准。",
      capacity: price || undefined,
      distanceTip: "可作为自驾游客路线起终点或中途换乘点。",
      actionLabel: "导航前往",
      detailItems: ["停车余位", "收费标准", "导航前往", "错峰建议"],
    };
  }

  if (type === "restroom") {
    return {
      status: "附近便民设施，可用于地图服务查询。",
      distanceTip: "适合在行程中作为便民补给点。",
      actionLabel: "查看位置",
      detailItems: ["公共厕所", "位置查询", "设施报修"],
    };
  }

  if (category === "医院") {
    return {
      status: "医疗救援点，紧急情况请优先拨打 120。",
      capacity: subtype || undefined,
      distanceTip: "可用于游客医疗求助和应急导航。",
      actionLabel: "联系/导航",
      detailItems: ["医疗救援", "电话联系", "导航前往"],
    };
  }

  if (category === "公安/警务点") {
    return {
      status: "公安/警务服务点，紧急情况请拨打 110。",
      capacity: subtype || undefined,
      distanceTip: "可用于游客求助、失物和安全服务。",
      actionLabel: "联系/导航",
      detailItems: ["警务求助", "失物协助", "导航前往"],
    };
  }

  if (type === "lodging") {
    return {
      status: "住宿候选点，价格和余房以后端实时接口为准。",
      capacity: price || undefined,
      distanceTip: "适合作为两日游或夜游路线的落脚点。",
      actionLabel: "查看住宿",
      detailItems: ["房价参考", "余房查询", "停车信息", "导航前往"],
    };
  }

  return undefined;
}

function restaurantProfileFrom(row, crowdLevel) {
  const category = cleanCell(row["子类"]) || "本地餐饮";
  const tags = splitTags(row["标签"], [category]);
  const score = cleanCell(row["评分"]) || "暂无";
  return {
    mainFoods: tags.slice(0, 5),
    averageCost: cleanCell(row["价格/费用/余量"]) || "以后端实时价格为准",
    popularity: crowdLevel,
    reviewSummary: `${row["名称"]}属于${category}，评分${score}，适合作为常熟行程中的用餐/休息节点。`,
    recommendedDishes: tags.slice(0, 5).length ? tags.slice(0, 5) : [category],
    queueTip: queueTipFrom(crowdLevel),
  };
}

function mapTieredRowToPlace(row) {
  const category = cleanCell(row["分类"]);
  const type = categoryToType.get(category);
  const lng = toNumber(row["经度"]);
  const lat = toNumber(row["纬度"]);
  if (!type || typeof lng !== "number" || typeof lat !== "number") {
    return null;
  }

  const xy = lngLatToXY(lng, lat);
  const subtype = cleanCell(row["子类"]);
  const address = cleanCell(row["地址"]);
  const crowdLevel = crowdLevelFrom(row);
  const rawImageUrl = cleanCell(row["图片URL"]);
  const categoryFallbackImage = fallbackImageByCategory[category] ?? fallbackImageByType[type];
  const imageUrl =
    !rawImageUrl || rawImageUrl === "/map-skins/guli-ancient-town.png"
      ? categoryFallbackImage
      : rawImageUrl;
  const tags = splitTags(row["标签"], [category, subtype]);
  const duration = formatDuration(row["建议游览分钟"], type);
  const summary =
    cleanCell(row["简介/用途"]) ||
    `${row["名称"]}是常熟${category}类点位，可用于地图浏览、行程规划和周边服务查询。`;

  const place = {
    id: makePlaceId(row, type),
    type,
    name: cleanCell(row["名称"]),
    subtitle: [subtype, address].filter(Boolean).join(" · ") || category,
    summary,
    tags,
    imageUrl,
    fallbackImageUrl: categoryFallbackImage,
    source: "database",
    poiId: cleanCell(row["POI_ID"]) || undefined,
    address: address || undefined,
    categoryLabel: category,
    subtypeLabel: subtype || undefined,
    score: cleanCell(row["评分"]) || undefined,
    phone: cleanCell(row["电话"]) || undefined,
    dynamicText: cleanCell(row["动态字段"]) || undefined,
    selectionScore: toNumber(row["选择分"]) ?? undefined,
    position: {
      ...xy,
      lng,
      lat,
    },
    openTime: cleanCell(row["开放/服务时间"]) || undefined,
    price: cleanCell(row["价格/费用/余量"]) || undefined,
    crowdLevel,
    duration,
    history: summary,
    detail: detailFrom(row) || undefined,
    notice: undefined,
    routeMeta: {
      canRoute: true,
      recommendedStayMinutes: recommendedStayMinutes(row, type),
      routeWeight: routeWeightFrom(row),
    },
    dataStatus: "verified",
  };

  const serviceProfile = serviceProfileFrom(row, type, category);
  if (serviceProfile) place.serviceProfile = serviceProfile;
  if (type === "food" && category === "美食") place.restaurantProfile = restaurantProfileFrom(row, crowdLevel);

  return place;
}

function mapFullPoiRow(row) {
  const lng = toNumber(row["经度"]);
  const lat = toNumber(row["纬度"]);
  const category = cleanCell(row["分类"]);
  const slug = categoryToSlug.get(category) ?? cleanCell(row["原始分类"]) ?? "poi";
  const fallbackImageUrl = fallbackImageByCategory[category] ?? "/assets/generated-placeholders/service.png";
  const allImageUrls = cleanCell(row["全部图片URL"])
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: `poi-${slug}-${toIdPart(row["POI_ID"]) || toIdPart(row["全局序号"])}`,
    poiId: cleanCell(row["POI_ID"]) || undefined,
    name: cleanCell(row["名称"]),
    categoryLabel: category,
    rawCategory: cleanCell(row["原始分类"]) || undefined,
    subtype: cleanCell(row["子类"]) || undefined,
    address: cleanCell(row["地址"]) || undefined,
    lng,
    lat,
    score: cleanCell(row["评分"]) || undefined,
    price: cleanCell(row["价格/费用"]) || undefined,
    openTime: cleanCell(row["开放/服务时间"]) || undefined,
    phone: cleanCell(row["电话"]) || undefined,
    tags: splitTags(row["标签"], [category, cleanCell(row["子类"])]),
    summary: cleanCell(row["简介/用途"]) || undefined,
    imageUrl: cleanCell(row["图片URL"]) || fallbackImageUrl,
    fallbackImageUrl,
    allImageUrls,
    dynamicText: cleanCell(row["动态/扩展字段"]) || undefined,
    source: cleanCell(row["数据来源"]) || "amap",
    remark: cleanCell(row["备注"]) || undefined,
  };
}

function countBy(rows, key) {
  return rows.reduce((record, row) => {
    const value = cleanCell(row[key]) || "未分类";
    record[value] = (record[value] ?? 0) + 1;
    return record;
  }, {});
}

function writeTs(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  const tieredRows = readCsv(tieredCsvPath);
  const fullPoiRows = readCsv(fullPoiCsvPath);
  const generatedPlaces = [];
  let skippedInvalidCoordinate = 0;

  for (const row of tieredRows) {
    const place = mapTieredRowToPlace(row);
    if (!place) {
      skippedInvalidCoordinate += 1;
      continue;
    }
    generatedPlaces.push(place);
  }

  const fullPoiIndex = fullPoiRows.map(mapFullPoiRow);
  const meta = {
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      tiered: "src/data/all_tiered_dataset.csv",
      fullPoi: "src/data/full_poi_dataset.csv",
    },
    tieredRows: tieredRows.length,
    generatedPlaces: generatedPlaces.length,
    skippedInvalidCoordinate,
    fullPoiRows: fullPoiRows.length,
    categoryCounts: countBy(tieredRows, "分类"),
    tierCounts: countBy(tieredRows, "等级"),
    fullPoiCategoryCounts: countBy(fullPoiRows, "分类"),
  };

  writeTs(
    generatedPlacesPath,
    `// Auto-generated by scripts/convert-csv-to-places.mjs. Do not edit manually.\nimport type { Place } from "../types/place";\n\nexport const databasePlaces: Place[] = ${JSON.stringify(
      generatedPlaces,
      null,
      2,
    )};\n`,
  );

  writeTs(
    generatedPoiIndexJsonPath,
    `${JSON.stringify(fullPoiIndex, null, 2)}\n`,
  );

  writeTs(
    generatedPoiIndexPath,
    `// Auto-generated by scripts/convert-csv-to-places.mjs. Do not edit manually.\nimport fullPoiIndexJson from "./generatedPoiIndex.json";\n\nexport type FullPoiRecord = {\n  id: string;\n  poiId?: string;\n  name: string;\n  categoryLabel: string;\n  rawCategory?: string;\n  subtype?: string;\n  address?: string;\n  lng: number | null;\n  lat: number | null;\n  score?: string;\n  price?: string;\n  openTime?: string;\n  phone?: string;\n  tags: string[];\n  summary?: string;\n  imageUrl?: string;\n  fallbackImageUrl?: string;\n  allImageUrls: string[];\n  dynamicText?: string;\n  source: string;\n  remark?: string;\n};\n\nexport const fullPoiIndex = fullPoiIndexJson as FullPoiRecord[];\n`,
  );

  writeTs(
    generatedMetaPath,
    `// Auto-generated by scripts/convert-csv-to-places.mjs. Do not edit manually.\n\nexport const datasetMeta = ${JSON.stringify(
      meta,
      null,
      2,
    )} as const;\n`,
  );

  console.log(
    `Generated ${generatedPlaces.length} map places and ${fullPoiIndex.length} full POI records.`,
  );
  if (skippedInvalidCoordinate > 0) {
    console.warn(`Skipped ${skippedInvalidCoordinate} rows without valid coordinates.`);
  }
}

main();
