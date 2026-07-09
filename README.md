# 常熟全域文旅智能出行助手

这是一个以地图为核心的一页式 Web 原型，当前已经从原来的静态滚动页面升级为 `master` 分支的 React/Vite 地图架构，并在此基础上融合了本地页面的卡片风格、图片素材、服务入口和文旅内容。

当前版本的产品重点是：

- 打开页面即进入常熟地图工作台。
- 保留 `master` 的地图、点位筛选、J/P 模式、路线生成、随机路线、右侧行程面板、拖拽规划、地图工具、手绘层、路线连线和高德路线规划能力。
- 把原滚动页面中的 AI 行程、实时地图、停车客流、景区讲解、诉求闭环等能力迁移到顶部“服务”菜单、地图点位、小卡片、展开详情和右侧路线面板中。
- 使用本地常熟景点、美食和非遗图片素材，避免卡片展开后图片拉伸。

## 技术栈

- Vite
- React
- TypeScript
- Leaflet
- 高德 JavaScript API
- lucide-react
- 原生 HTML Drag and Drop
- 本地静态 TypeScript 数据

## 快速启动

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

默认会启动在：

```text
http://localhost:5173/
```

如果 `5173` 被占用，Vite 会自动切换到下一个端口。例如本次本地启动地址为：

```text
http://127.0.0.1:5174/
```

构建生产版本：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

## 当前目录结构

```text
.
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   ├── assets/                         # 当前页面使用的本地图片素材
│   │   └── photo-library/
│   ├── map-skins/                      # master 原有区域贴图
│   └── map-tiles/                      # 本地瓦片包解压位置，默认被 gitignore
├── src/
│   ├── App.tsx                         # 全局状态、J/P 模式、路线生成、行程面板
│   ├── main.tsx
│   ├── components/
│   │   ├── AmapChangshuMap.tsx         # 高德地图实现
│   │   ├── ChangshuMap.tsx             # 高德 / 备用地图切换
│   │   ├── FallbackChangshuMap.tsx     # Leaflet 备用地图
│   │   ├── ItineraryPanel.tsx          # 右侧行程规划面板
│   │   ├── PlaceCard.tsx               # 地图小卡片和详情卡片
│   │   └── TopBar.tsx                  # 紧凑顶部工具条、服务菜单、筛选和路线工具
│   ├── api/
│   │   └── placesApi.ts                # 未来数据库 / 实时接口预留入口
│   ├── data/
│   │   ├── places.ts                   # 地图点位、卡片详情和服务点位
│   │   ├── routes.ts                   # P 人预设路线
│   │   ├── services.ts                 # 顶部“服务”菜单配置
│   │   ├── mapSkins.ts                 # 地图区域贴图
│   │   └── fullCityHanddrawnTileRanges.ts
│   ├── map/
│   │   ├── amapLoader.ts               # 高德脚本加载和配置读取
│   │   └── amapRouteService.ts         # 高德步行/骑行/驾车路线规划
│   ├── styles/
│   │   └── global.css
│   ├── types/
│   │   ├── place.ts
│   │   └── route.ts
│   └── utils/
│       ├── itineraryRoute.ts
│       └── routePlanner.ts
```

## 高德地图配置

高德配置通过环境变量读取。当前本地开发使用 `.env.local`：

```text
VITE_AMAP_KEY=你的高德 Web 端 Key
VITE_AMAP_SECURITY_CODE=你的高德安全密钥
VITE_AMAP_STYLE=amap://styles/fresh
```

`.env.local` 已经在 `.gitignore` 中，不会被提交。

如果其他人拉代码后地图没有加载，需要自己创建 `.env.local`，或者复制 `.env.example` 后补充真实 Key。

排查高德问题时重点检查：

- Key 是否是 JavaScript API 的 Web 端 Key。
- 安全密钥是否与 Key 匹配。
- 高德控制台域名白名单是否包含 `localhost`、`127.0.0.1` 和正式部署域名。
- 浏览器控制台是否有鉴权失败、脚本加载失败或插件加载失败。
- 网络是否可以访问 `https://webapi.amap.com/maps`。

如果高德加载失败，页面会回退到 `FallbackChangshuMap`，仍然可以演示点位、卡片、拖拽规划和路线预览。

## 风格化瓦片包

如果需要启用 master 的常熟手绘风格瓦片，把 `changshu-full-city-all-zooms-handdrawn.zip` 解压到：

```text
public/map-tiles/
```

正确目录应为：

```text
public/map-tiles/changshu-full-city-all-zooms/handdrawn/
```

正确验证文件示例：

```text
public/map-tiles/changshu-full-city-all-zooms/handdrawn/18/218897/106686.png
```

不要解压成：

```text
public/map-tiles/changshu-full-city-all-zooms-handdrawn/changshu-full-city-all-zooms/...
public/map-tiles/changshu-full-city-all-zooms.zip/...
```

`public/map-tiles/` 默认被 `.gitignore` 忽略，避免把大体积瓦片提交进仓库。

## 当前保留的 master 功能

本次改造以 `master` 为底座，以下功能仍然保留：

- 高德地图优先加载。
- 高德失败后回退 Leaflet 备用地图。
- 手绘风格瓦片叠加。
- 区域贴图覆盖。
- 点位筛选。
- J 人 / P 人模式。
- 主题路线选择。
- 生成预设路线。
- 随机路线。
- 右侧行程面板。
- 右侧行程面板默认可收起。
- 点击地图点位打开卡片。
- 双击或点击按钮展开详情。
- 卡片加入行程。
- 卡片拖拽到右侧行程面板。
- 行程面板内拖拽排序。
- 删除单个点位。
- 清空路线。
- 路线点数和预计时长。
- 步行 / 骑行 / 驾车切换。
- 列表 / 卡牌视图切换。
- 地图路线连线。
- 高德道路级路线规划。
- 地图手绘层和清除手绘。
- 地图工具收起 / 展开。

## 本次新增和融合的能力

在保留 master 功能的基础上，当前版本新增：

- 顶部紧凑工具条：品牌、点位筛选、J/P 模式、路线主题、生成、随机、行程统计和清空保留在一行内。
- 顶部“服务”菜单：行程规划、智能讲解、景区舒适度、停车查询、实时路况、门票预约、找厕所、行李寄存、旅游驿站、美食推荐、投诉求助、一键客服默认收起，点击后展开。
- 更多地图点位类型：停车、厕所、服务、活动、住宿、救援。
- 点位卡片接入本地图片素材。
- 展开卡片可覆盖地图内容，但不撑大页面。
- 卡片根据点位位置自动选择上方、下方、左侧、右侧或居中展开。
- 详情内容在卡片内部滚动。
- 停车、厕所、驿站、活动、住宿、救援点位支持服务型详情字段。
- 地图服务菜单可以直接切换对应图层，默认不再横向铺开大服务卡片。

## 如何更新点位

点位数据在：

```text
src/data/places.ts
```

一个点位的基本结构：

```ts
{
  id: "yushan",
  type: "scenic",
  name: "虞山国家森林公园",
  subtitle: "北门大街 21 号的国家级森林公园",
  summary: "适合轻徒步和老城慢游。",
  tags: ["山水", "历史", "Citywalk"],
  imageUrl: "/assets/photo-library/spot-yushan-01.jpg",
  source: "local",
  poiId: "amap-or-db-poi-id",
  address: "常熟市虞山片区",
  district: "常熟市",
  position: { x: 42, y: 36, lng: 120.709847, lat: 31.665592 },
  openTime: "约 08:00-17:00",
  price: "部分区域免费，部分项目另收费",
  crowdLevel: "high",
  duration: "2-3 小时",
  history: "历史文化简介",
  detail: "展开详情中的规划建议",
  suitableFor: ["历史文化爱好者", "轻徒步用户"],
  notice: "开放信息以景区公告为准。",
  dataStatus: "demo"
}
```

字段说明：

- `source`：数据来源，可选 `local`、`database`、`amap`、`manual`。
- `poiId`：后续接入高德 POI 或数据库时使用的真实标识。
- `address` / `district`：后续数据库字段预留。
- `dataStatus`：`demo` 表示演示数据，`verified` 表示已经校准。当前美食和店铺坐标多为 demo，后续接数据库后再校准。

常用 `type`：

- `scenic`：景点
- `heritage`：非遗
- `food`：具体美食
- `restaurant`：美食店铺
- `parking`：停车场
- `restroom`：厕所
- `service`：旅游驿站 / 寄存 / 客服
- `activity`：活动 / 演艺 / 夜游
- `lodging`：住宿
- `emergency`：投诉 / 救援 / 闭环工单

服务型点位可以增加 `serviceProfile`：

```ts
serviceProfile: {
  status: "开放中，当前排队约 3 分钟",
  capacity: "行李寄存剩余 28 格",
  distanceTip: "靠近古城美食和非遗体验点",
  actionLabel: "打开一码通",
  detailItems: ["游客咨询", "行李寄存", "饮水休息", "一键客服"]
}
```

## 如何更新顶部服务入口

顶部服务入口在：

```text
src/data/services.ts
```

示例：

```ts
{
  id: "parking",
  icon: "P",
  label: "停车查询",
  hint: "余位与拥堵",
  targetTypes: ["parking"]
}
```

`targetTypes` 会控制点击服务入口后显示哪些地图点位类型。

## 未来数据库接口预留

当前点位仍来自静态 demo 数据，但已经预留接口层：

```text
src/api/placesApi.ts
```

当前函数：

```ts
fetchPlaces()
fetchRoutes()
fetchRealtimeStatus()
fetchParkingStatus()
fetchServiceTickets()
```

现在这些函数返回本地静态数据。后续接数据库时，优先只替换这里的实现，让接口返回的数据保持和 `Place` 类型兼容。这样地图组件、卡片组件、右侧行程面板和路线规划逻辑都不需要重写。

当前美食和店铺地图位置主要用于演示筛选、卡片和路线规划，不代表已经完成真实 POI 校准。后续数据库可以返回真实 `lng`、`lat`、`poiId`、`address`、`source` 和 `dataStatus: "verified"` 来覆盖 demo 数据。

## 如何更新 P 人路线

路线数据在：

```text
src/data/routes.ts
```

示例：

```ts
{
  id: "classic-culture",
  name: "文化慢游线",
  description: "老城园林、名人故居与虞山山水组合。",
  placeIds: ["fangta", "zengzhao", "weng-tonghe", "yushan", "old-kitchen"]
}
```

注意：`placeIds` 必须对应 `src/data/places.ts` 中存在的 `id`。

## 图片素材

当前本地图片已放到：

```text
public/assets/photo-library/
```

在点位里这样引用：

```ts
imageUrl: "/assets/photo-library/spot-yushan-01.jpg"
```

卡片图片使用固定比例容器和 `cover` 方式显示，展开详情时不会把图片拉伸成长条。

## 常用调试命令

类型和构建检查：

```bash
npm run build
```

启动开发服务：

```bash
npm run dev
```

访问本地服务：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173/
```

如果端口被占用，根据 Vite 输出访问实际端口，例如：

```text
http://127.0.0.1:5174/
```

## 常见问题

### 1. 地图空白

先看浏览器控制台。常见原因是高德 Key 或安全密钥错误、域名白名单未配置、本地没有网络、瓦片路径错误。

### 2. 高德地图失败

页面会自动回退备用地图。高德失败不影响卡片、路线、拖拽和 P 人路线生成演示。

### 3. 手绘瓦片不显示

检查瓦片路径是否正确：

```text
public/map-tiles/changshu-full-city-all-zooms/handdrawn/18/218897/106686.png
```

### 4. 新增点位不显示

检查：

- `type` 是否在 `src/types/place.ts` 中存在。
- 顶部筛选是否选中了该类型。
- `position.lng` / `position.lat` 是否正确。
- `id` 是否唯一。

### 5. P 人路线生成后缺点位

检查 `src/data/routes.ts` 中的 `placeIds` 是否都能在 `src/data/places.ts` 中找到。

### 6. 图片不显示

检查：

- 图片是否在 `public/assets/photo-library/`。
- `imageUrl` 是否以 `/assets/...` 开头。
- 文件名大小写是否一致。

### 7. 卡片展开后遮挡

当前设计允许展开卡片覆盖地图内容。它不会撑大页面，详情内容在卡片内部滚动。若需要调整尺寸，修改 `src/styles/global.css` 中：

```css
.map-card-popover.is-expanded
.place-card.planner-place-card.is-expanded
.planner-detail-scroll
```

## 后端接口字段要求

后续接数据库时，建议后端返回的数据尽量兼容当前前端 `Place` 类型。前端已经预留入口：

```text
src/api/placesApi.ts
```

优先替换这些函数，不建议重写地图组件：

```ts
fetchPlaces()
fetchRoutes()
fetchRealtimeStatus()
fetchParkingStatus()
fetchServiceTickets()
```

### 1. 点位列表

接口：

```text
GET /api/places
```

返回所有地图点位，包括景点、非遗、美食、店铺、停车、厕所、服务、活动、住宿、救援。美食和店铺的真实坐标也由这个接口返回。

```ts
type Place = {
  id: string;
  type:
    | "scenic"
    | "heritage"
    | "food"
    | "restaurant"
    | "parking"
    | "restroom"
    | "service"
    | "activity"
    | "lodging"
    | "emergency";
  name: string;
  subtitle?: string;
  summary?: string;
  tags?: string[];
  position: {
    lng: number;
    lat: number;
    x?: number;
    y?: number;
  };
  imageUrl?: string;
  images?: string[];
  source?: "local" | "database" | "amap" | "manual";
  dataStatus?: "demo" | "verified";
  poiId?: string;
  amapPoiId?: string;
  address?: string;
  district?: string;
  openTime?: string;
  price?: string;
  ticket?: string;
  duration?: string;
  crowdLevel?: "low" | "medium" | "high" | "very-high";
  history?: string;
  detail?: string;
  notice?: string;
  suitableFor?: string[];
  bookingUrl?: string;
  guideUrl?: string;
  phone?: string;
  officialUrl?: string;
  foodProfile?: FoodProfile;
  restaurantProfile?: RestaurantProfile;
  serviceProfile?: ServiceProfile;
  parkingProfile?: ParkingProfile;
  restroomProfile?: RestroomProfile;
  emergencyProfile?: EmergencyProfile;
  guideProfile?: GuideProfile;
};
```

说明：

- `position.lng` 和 `position.lat` 是真实地图必填字段。
- `x` 和 `y` 只是备用地图或兜底定位字段。
- `dataStatus: "demo"` 表示演示坐标，前端会提示“示例点位”。
- `dataStatus: "verified"` 表示后端已经校准坐标，前端可作为真实点位展示。

### 2. 美食和店铺

具体美食 `type = "food"`：

```ts
type FoodProfile = {
  flavor?: string;
  history?: string;
  recommendedScene?: string;
  relatedRestaurants?: string[];
  averagePrice?: string;
  bestSeason?: string;
  ingredients?: string[];
};
```

美食店铺 `type = "restaurant"`：

```ts
type RestaurantProfile = {
  mainFoods?: string[];
  averageCost?: string;
  popularity?: "low" | "medium" | "high" | "very-high";
  reviewSummary?: string;
  recommendedDishes?: string[];
  queueTip?: string;
  businessHours?: string;
  phone?: string;
  bookingUrl?: string;
  menu?: Array<{
    name: string;
    price?: string;
    imageUrl?: string;
    description?: string;
  }>;
};
```

美食位置要求：

- 后端接入后必须返回真实 `lng` / `lat`。
- 如果来自高德或数据库，建议同步返回 `poiId` / `amapPoiId`。
- 已校准点位返回 `dataStatus: "verified"`。
- 未校准临时点位返回 `dataStatus: "demo"`。

### 3. 停车

停车点 `type = "parking"`：

```ts
type ParkingProfile = {
  totalSpaces?: number;
  availableSpaces?: number;
  chargingSpaces?: number;
  disabledSpaces?: number;
  priceRule?: string;
  congestionLevel?: "low" | "medium" | "high";
  distanceTip?: string;
  navigationUrl?: string;
  updatedAt?: string;
};
```

实时停车接口：

```text
GET /api/realtime/parking
```

```ts
type ParkingStatus = {
  placeId: string;
  totalSpaces: number;
  availableSpaces: number;
  chargingSpaces?: number;
  congestionLevel?: "low" | "medium" | "high";
  updatedAt: string;
};
```

### 4. 厕所、服务、救援

厕所点 `type = "restroom"`：

```ts
type RestroomProfile = {
  openStatus?: "open" | "closed" | "maintenance";
  accessible?: boolean;
  babyCare?: boolean;
  distanceTip?: string;
  cleanLevel?: "good" | "normal" | "poor";
  reportUrl?: string;
};
```

服务点 / 驿站 / 寄存 `type = "service"`：

```ts
type ServiceProfile = {
  status?: string;
  capacity?: string;
  distanceTip?: string;
  actionLabel?: string;
  detailItems?: string[];
  luggageAvailable?: number;
  water?: boolean;
  restArea?: boolean;
  accessible?: boolean;
  servicePhone?: string;
};
```

救援 / 投诉点 `type = "emergency"`：

```ts
type EmergencyProfile = {
  serviceStatus?: "online" | "busy" | "offline";
  avgResponseMinutes?: number;
  supportTypes?: string[];
  submitUrl?: string;
  phone?: string;
};
```

### 5. 景区讲解

景点和非遗点位可带讲解字段：

```ts
type GuideProfile = {
  title?: string;
  audioUrl?: string;
  audioDuration?: string;
  transcript?: string;
  routeTips?: string[];
  performanceReminders?: Array<{
    title: string;
    time: string;
    place?: string;
    bookingUrl?: string;
  }>;
};
```

### 6. 路线

接口：

```text
GET /api/routes
```

```ts
type RoutePreset = {
  id: string;
  name: string;
  description: string;
  placeIds: string[];
  tags?: string[];
  suitableFor?: string[];
  estimatedMinutes?: number;
};
```

`placeIds` 必须能在 `/api/places` 返回的点位中找到。

### 7. 实时状态

接口：

```text
GET /api/realtime/status
```

```ts
type RealtimeStatus = {
  placeId: string;
  crowdLevel?: "low" | "medium" | "high" | "very-high";
  crowdText?: string;
  parkingLeft?: number;
  queueMinutes?: number;
  comfortText?: string;
  updatedAt: string;
};
```

### 8. 诉求工单

提交工单：

```text
POST /api/service-tickets
```

```ts
type CreateTicketRequest = {
  placeId?: string;
  category: "complaint" | "rescue" | "lost" | "repair" | "consult";
  title: string;
  content: string;
  contact?: string;
  lng?: number;
  lat?: number;
  images?: string[];
};
```

返回：

```ts
type ServiceTicket = {
  id: string;
  title: string;
  status: "submitted" | "assigned" | "processing" | "closed";
  placeId?: string;
  createdAt: string;
  updatedAt: string;
  expectedResponseMinutes?: number;
};
```

查询工单：

```text
GET /api/service-tickets/:id
```

## 生产部署建议

构建：

```bash
npm run build
```

部署 `dist/` 到静态服务器即可。

上线前注意：

- 正式域名要加入高德 Key 白名单。
- 不要把 `.env.local` 提交到公开仓库。
- 大体积瓦片包不要直接提交到 git，建议单独分发或放对象存储。
- 若接入真实数据库，尽量保持 `places.ts` 结构不变，把数据源替换为接口返回。
