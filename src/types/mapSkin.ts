export type MapSkinId = "handdrawn" | "normal" | "fresh" | "grey" | "light" | "dark" | "macaron";

export type MapSkinOption = {
  id: MapSkinId;
  name: string;
  description: string;
  amapStyle: string;
  handdrawn: boolean;
};

export const mapSkinOptions: MapSkinOption[] = [
  {
    id: "handdrawn",
    name: "手绘文旅",
    description: "当前风格化瓦片",
    amapStyle: "amap://styles/whitesmoke",
    handdrawn: true,
  },
  {
    id: "normal",
    name: "高德默认",
    description: "原生标准配色",
    amapStyle: "amap://styles/normal",
    handdrawn: false,
  },
  {
    id: "fresh",
    name: "清新",
    description: "浅绿低饱和",
    amapStyle: "amap://styles/fresh",
    handdrawn: false,
  },
  {
    id: "grey",
    name: "雅灰",
    description: "弱化背景信息",
    amapStyle: "amap://styles/grey",
    handdrawn: false,
  },
  {
    id: "light",
    name: "月光银",
    description: "明亮简洁",
    amapStyle: "amap://styles/light",
    handdrawn: false,
  },
  {
    id: "dark",
    name: "幻影黑",
    description: "夜间暗色",
    amapStyle: "amap://styles/dark",
    handdrawn: false,
  },
  {
    id: "macaron",
    name: "马卡龙",
    description: "柔和明快",
    amapStyle: "amap://styles/macaron",
    handdrawn: false,
  },
];
