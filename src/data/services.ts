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
  { id: "traffic", icon: "路", label: "实时路况", hint: "路线拥堵提示", targetTypes: ["parking", "service"] },
  { id: "ticket", icon: "票", label: "门票预约", hint: "景区入园入口", targetTypes: ["scenic", "activity"] },
  { id: "restroom", icon: "厕", label: "找厕所", hint: "开放与无障碍", targetTypes: ["restroom"] },
  { id: "luggage", icon: "寄", label: "行李寄存", hint: "驿站寄存服务", targetTypes: ["service"] },
  { id: "station", icon: "站", label: "旅游驿站", hint: "咨询休息饮水", targetTypes: ["service"] },
  { id: "food", icon: "食", label: "美食推荐", hint: "本帮菜和小吃", targetTypes: ["food", "restaurant"] },
  { id: "help", icon: "救", label: "投诉求助", hint: "闭环工单处理", targetTypes: ["emergency"] },
  { id: "customer", icon: "服", label: "一键客服", hint: "游客服务入口", targetTypes: ["service", "emergency"] },
];
