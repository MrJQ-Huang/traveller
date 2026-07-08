export type MapSkinOverlay = {
  id: string;
  name: string;
  imageUrl: string;
  center: [number, number];
  linkedPlaceId?: string;
  lockToPlace?: boolean;
  width: number;
  subtitle: string;
};

export const mapSkinOverlays: MapSkinOverlay[] = [
  {
    id: "skin-yushan",
    name: "虞山",
    imageUrl: "/map-skins/yushan.png",
    center: [120.721, 31.671],
    linkedPlaceId: "yushan",
    lockToPlace: true,
    width: 154,
    subtitle: "山水贴图测试",
  },
  {
    id: "skin-guli",
    name: "古里古镇",
    imageUrl: "/map-skins/guli-ancient-town.png",
    center: [120.887, 31.646],
    linkedPlaceId: "guli-ancient-town",
    lockToPlace: true,
    width: 146,
    subtitle: "古镇贴图测试",
  },
];
