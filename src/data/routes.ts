import type { RoutePreset } from "../types/place";

export const routePresets: RoutePreset[] = [
  {
    id: "classic-culture",
    name: "文化慢游线",
    description: "老城园林、名人故居与虞山山水组合。",
    placeIds: ["fangta", "zengzhao", "weng-tonghe", "yushan", "old-kitchen"],
  },
  {
    id: "heritage-maker",
    name: "非遗体验线",
    description: "花边、糕团、评弹与轻餐饮组合。",
    placeIds: ["lace-workshop", "pastry-workshop", "pingtan-teahouse", "pastry-store"],
  },
  {
    id: "food-walk",
    name: "美食探索线",
    description: "先认识美食，再进入美食品尝。",
    placeIds: ["xunyou-noodles", "noodle-house", "jiaohua-chicken", "old-kitchen", "guihua-chestnut"],
  },
  {
    id: "easy-half-day",
    name: "半日轻松线",
    description: "湖区游览和周边正餐，节奏更松。",
    placeIds: ["shanghu", "shanghu-farm", "guihua-chestnut", "pastry-store"],
  },
  {
    id: "full-day-mix",
    name: "一日综合线",
    description: "景点、非遗与美食美食混合。",
    placeIds: ["fangta", "xunyou-noodles", "lace-workshop", "shanghu", "old-kitchen"],
  },
];
