import type { PlaceType } from "../types/place";

export type ServiceShortcut = {
  id: string;
  icon: string;
  label: string;
  hint: string;
  targetTypes?: PlaceType[];
};

export const serviceShortcuts: ServiceShortcut[] = [
  { id: "ai", icon: "AI", label: "行程规划", hint: "一句话生成路线" },
  { id: "guide", icon: "听", label: "智能讲解", hint: "景区语音导览", targetTypes: ["scenic", "heritage"] },
  { id: "comfort", icon: "图", label: "景区舒适度", hint: "客流热度避峰", targetTypes: ["scenic"] },
  { id: "parking", icon: "P", label: "停车查询", hint: "余位与拥堵", targetTypes: ["parking"] },
  { id: "traffic", icon: "路", label: "实时路况", hint: "路线拥堵提示", targetTypes: ["parking"] },
  { id: "restroom", icon: "厕", label: "找厕所", hint: "开放与无障碍", targetTypes: ["restroom"] },
  { id: "food", icon: "食", label: "美食推荐", hint: "本帮菜和小吃", targetTypes: ["food"] },
  { id: "hospital", icon: "医", label: "医院", hint: "医疗急救导航", targetTypes: ["hospital"] },
  { id: "police", icon: "警", label: "公安", hint: "警务求助导航", targetTypes: ["police"] },
];
