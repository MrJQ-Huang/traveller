# CSV 数据集说明：精选分层表与全量 POI 表

更新时间：2026-07-09

本文档说明两个用于交付、前端展示和后续维护的 CSV 数据集：

- `all_tiered_dataset.csv`：精选分层数据集，用于前端地图分层展示、路线规划和卡片详情。
- `full_poi_dataset.csv`：全量 POI 数据集，用于数据库底座、检索扩展、后续补充筛选和人工复核。

两个文件均位于：

```text
changshu-ai-deliverable/usable-data/data/curated/
```

本地完整路径：

```text
D:\codex_prj\changshu-ai\changshu-ai-deliverable\usable-data\data\curated\all_tiered_dataset.csv
D:\codex_prj\changshu-ai\changshu-ai-deliverable\usable-data\data\curated\full_poi_dataset.csv
```

Gitee `tyb` 分支路径：

```text
changshu-ai-deliverable/usable-data/data/curated/all_tiered_dataset.csv
changshu-ai-deliverable/usable-data/data/curated/full_poi_dataset.csv
```

---

## 1. 两个 CSV 的区别

| 文件 | 定位 | 数据量 | 是否分层 | 主要用途 |
|---|---|---:|---|---|
| `all_tiered_dataset.csv` | 精选数据集 | 450 | 是，含 L4/L3/L2 | 前端地图展示、缩放分层、路线规划、演示卡片 |
| `full_poi_dataset.csv` | 全量 POI 数据库 | 2279 | 否 | 底层数据库、检索、后续扩容、重新筛选、人工复核 |

简单理解：

```text
full_poi_dataset.csv 是“全量底库”。
all_tiered_dataset.csv 是从底库和补充数据中筛选、标注、分层后的“可直接用于 UI 的精选表”。
```

---

## 2. all_tiered_dataset.csv 说明

### 2.1 文件定位

`all_tiered_dataset.csv` 是前端当前主要使用的数据集。它将景点、美食、酒店、医院、停车场、公安/警务点、卫生间统一到一张表中，并为每条数据标注 L4/L3/L2 等级。

它适合用于：

- 地图点位展示。
- 类别按钮显隐切换。
- 按地图缩放层级控制 L4/L3/L2 可见性。
- 路线规划卡片。
- 前端详情弹窗。
- 比赛演示中的“可用精选数据集”。

### 2.2 数据量

总计：450 条。

| 分类 | 数量 |
|---|---:|
| 景点 | 60 |
| 美食 | 60 |
| 酒店 | 60 |
| 医院 | 60 |
| 停车场 | 70 |
| 公安/警务点 | 70 |
| 卫生间 | 70 |

### 2.3 等级统计

| 等级 | 数量 | 含义 |
|---|---:|---|
| L4 | 40 | 核心展示点，地图未放大时优先展示 |
| L3 | 170 | 重要节点，中等缩放后展示 |
| L2 | 240 | 补充节点，高缩放或精细浏览时展示 |

### 2.4 各分类分层规则

景点、美食、酒店、医院：

| 等级 | 数量 | 说明 |
|---|---:|---|
| L4 | 10 | 核心样板点，适合首屏展示 |
| L3 | 20 | 重要规划点，适合中等缩放展示 |
| L2 | 30 | 补充点，适合放大后展示 |

停车场、公安/警务点、卫生间：

| 等级 | 数量 | 说明 |
|---|---:|---|
| L3 | 30 | 主要公共服务点，默认服务层展示 |
| L2 | 40 | 补充公共服务点，放大后展示 |

### 2.5 字段说明

| 字段 | 说明 |
|---|---|
| `全局序号` | 全表统一序号 |
| `分类` | 中文分类，如景点、美食、酒店 |
| `分类内序号` | 当前分类内的序号 |
| `等级` | L4/L3/L2 分层等级 |
| `POI_ID` | POI 标识，部分来自高德或人工补充编号 |
| `名称` | 点位名称 |
| `子类` | 更细的类型，如 5A、宾馆酒店、公共厕所等 |
| `地址` | 点位地址 |
| `经度` | GCJ-02 坐标经度 |
| `纬度` | GCJ-02 坐标纬度 |
| `评分` | 评分或人工估计评分，可能为空 |
| `价格/费用/余量` | 门票、餐饮价格、酒店价格/余房、停车容量等信息 |
| `开放/服务时间` | 开放时间或服务时间 |
| `建议游览分钟` | 建议停留或游览时长 |
| `电话` | 联系电话，可能为空 |
| `标签` | 关键词标签，供筛选、卡片展示和路线推荐使用 |
| `简介/用途` | 点位介绍或在系统中的用途说明 |
| `图片URL` | 主图 URL；未匹配到真实图时可能使用本地古风示意图 |
| `动态字段` | 价格、余房、容量、动态估算等扩展字段 |
| `数据用途` | 该数据在前端或规划中的主要用途 |
| `选择分` | 筛选、排序或人工选择时的参考分 |
| `备注` | 数据质量、来源、注意事项或人工复核说明 |

### 2.6 前端缩放显示逻辑

当前前端根据 `等级` 字段控制地图点位可见性。

对于有 L4 的分类：景点、美食、酒店、医院。

```text
低缩放：显示 L4
中缩放：显示 L4 + L3
高缩放：显示 L4 + L3 + L2
```

对于无 L4 的分类：停车场、公安/警务点、卫生间。

```text
低缩放：显示 L3
高缩放：显示 L3 + L2
```

高德地图当前缩放范围为 10-18，因此：

```text
景点/美食/酒店/医院的 L3 大约在 zoom >= 13 时出现。
停车场/公安警务点/卫生间的 L3 从 zoom = 10 即可显示。
```

### 2.7 图片说明

当前已补充以下层级图片：

| 分类/等级 | 图片覆盖 |
|---|---:|
| 景点 L3 | 20/20 |
| 美食 L3 | 20/20 |
| 酒店 L4 | 10/10 |
| 酒店 L3 | 20/20 |

图片来源优先级：

```text
同名/近似同名 POI 图片 > 原有高德图片 > 本地古风示意图
```

如果未匹配到同名或近似同名真实图片，不再使用同类近邻代表图，而是使用本地古风示意图：

```text
/map-skins/guli-ancient-town.png
```

备注字段会标记：

```text
图片URL补充：未匹配到同名/近似同名POI图片，使用本地古风示意图。
```

---

## 3. full_poi_dataset.csv 说明

### 3.1 文件定位

`full_poi_dataset.csv` 是统一整理后的全量 POI 数据库。它不是直接用于地图首屏展示的精选数据，而是作为底层数据池使用。

它适合用于：

- 后续重新筛选 L4/L3/L2。
- 扩展更多类别，如公交站、充电站。
- 搜索和推荐候选集。
- 数据质量检查。
- 人工复核和补全字段。
- 后端数据库导入。

### 3.2 数据来源

主要来源包括：

```text
usable-data/data/raw/amap_pois.json
usable-data/data/raw/amap_missing_pois.json
```

数据经统一字段整理后输出为 CSV。

### 3.3 数据量

总计：2279 条。

| 分类 | 数量 |
|---|---:|
| 景点 | 225 |
| 美食 | 200 |
| 酒店 | 225 |
| 停车场 | 225 |
| 医院 | 200 |
| 公交站 | 225 |
| 卫生间 | 411 |
| 充电站 | 297 |
| 公安/警务点 | 271 |

### 3.4 字段说明

| 字段 | 说明 |
|---|---|
| `全局序号` | 全量表统一序号 |
| `分类` | 中文分类名称 |
| `原始分类` | 原始英文分类，如 attraction、food、hotel、toilet |
| `分类内序号` | 当前原始分类内的序号 |
| `POI_ID` | 高德 POI ID 或原始数据 ID |
| `名称` | POI 名称 |
| `子类` | 原始子类，如中餐厅、宾馆酒店、公共厕所 |
| `地址` | 地址 |
| `经度` | GCJ-02 经度 |
| `纬度` | GCJ-02 纬度 |
| `评分` | 原始评分，可能为空 |
| `价格/费用` | 原始价格、门票或费用字段 |
| `开放/服务时间` | 原始开放时间或营业时间 |
| `建议停留分钟` | 建议停留时间，可能为空或为 0 |
| `电话` | 电话，可能为空 |
| `标签` | 原始 tags、extra.tag、extra.keytag 合并后的标签 |
| `简介/用途` | 原始描述或自动生成的用途说明 |
| `图片URL` | 第一张图片 URL |
| `全部图片URL` | 全部图片 URL，用 `|` 分隔 |
| `动态/扩展字段` | 原始 extra JSON 字段 |
| `数据来源` | 数据来源，如 amap |
| `备注` | 全量数据说明和质量提醒 |

### 3.5 与 all_tiered_dataset.csv 的关系

`full_poi_dataset.csv` 是更大的候选池；`all_tiered_dataset.csv` 是可直接用于产品展示的精选池。

推荐使用方式：

```text
产品前端地图展示：优先使用 all_tiered_dataset.csv / all_tiered_dataset.json
后台检索和候选补充：使用 full_poi_dataset.csv
人工检查和重新分层：从 full_poi_dataset.csv 选点，再写入 all_tiered_dataset.csv
```

### 3.6 注意事项

- 全量表未做 L4/L3/L2 分层，不建议直接全部加载到地图上，否则点位会严重堆叠。
- 全量表包含公交站、充电站等类别，这些类别当前不一定在前端 UI 中启用。
- 全量表中部分字段可能为空，例如评分、电话、开放时间。
- 坐标使用 GCJ-02，适合高德地图展示。
- 运营时间、价格、余房、停车容量等信息具有时效性，正式使用前应再次校验。

---

## 4. 推荐交付文件

评审、答辩或团队交接时，建议同时提供：

```text
all_tiered_dataset.csv
full_poi_dataset.csv
DATASET_CSV_REFERENCE.md
```

其中：

```text
all_tiered_dataset.csv 说明“前端用什么”。
full_poi_dataset.csv 说明“底库有什么”。
DATASET_CSV_REFERENCE.md 说明“两个文件怎么用、有什么区别”。
```

---

## 5. 当前 Gitee 路径

```text
https://gitee.com/MrJQ123321/changshu-hackathon/blob/tyb/changshu-ai-deliverable/usable-data/data/curated/all_tiered_dataset.csv
https://gitee.com/MrJQ123321/changshu-hackathon/blob/tyb/changshu-ai-deliverable/usable-data/data/curated/full_poi_dataset.csv
```

---

## 6. 前端如何使用这些数据库

本节说明当前 Web 前端如何接入数据，以及后续如果更换 CSV/JSON 应该改哪些位置。

### 6.1 前端实际使用的文件

当前前端项目路径：

```text
D:\codex_prj\changshu-master
```

前端运行时实际读取的是 JSON 版本，而不是直接读取 CSV：

```text
D:\codex_prj\changshu-master\src\data\all_tiered_dataset.json
```

该文件由精选分层数据集同步而来，对应 CSV 为：

```text
D:\codex_prj\changshu-ai\changshu-ai-deliverable\usable-data\data\curated\all_tiered_dataset.csv
```

前端不直接读取 CSV 的原因：

```text
1. Vite/React 项目静态 import JSON 更稳定。
2. 不需要在浏览器端解析 CSV，减少前端运行时代码。
3. JSON 保留字段类型和嵌套结构更方便。
4. 构建时可以直接把数据打包进前端。
```

当前数据接入入口：

```text
D:\codex_prj\changshu-master\src\data\places.ts
```

核心流程是：

```text
all_tiered_dataset.json
        ↓
src/data/places.ts 中转换字段
        ↓
导出 places: Place[]
        ↓
App.tsx / ChangshuMap / PlaceCard / ItineraryPanel 使用 places
```

---

### 6.2 前端数据流

当前前端的数据流如下：

```text
src/data/all_tiered_dataset.json
  -> src/data/places.ts
  -> export const places
  -> src/App.tsx
  -> visiblePlaces / itineraryPlaces
  -> ChangshuMap
  -> AmapChangshuMap 或 FallbackChangshuMap
  -> 地图 marker / 卡片 / 路线规划
```

关键文件说明：

| 文件 | 作用 |
|---|---|
| `src/data/all_tiered_dataset.json` | 前端实际使用的数据源 |
| `src/data/places.ts` | 把数据集字段转换为前端 `Place` 类型 |
| `src/types/place.ts` | 定义 `Place`、`PlaceType`、`TierLevel` 等类型 |
| `src/App.tsx` | 管理分类筛选、选中点位、路线点位、路线模式 |
| `src/components/TopBar.tsx` | 顶部分类按钮，如景点、美食、酒店等 |
| `src/components/AmapChangshuMap.tsx` | 高德地图渲染、marker 渲染、缩放分层 |
| `src/components/FallbackChangshuMap.tsx` | 高德不可用时的轻量备用地图 |
| `src/components/PlaceCard.tsx` | 地图点位卡片和路线卡片 |
| `src/components/ItineraryPanel.tsx` | 右侧路线规划面板 |
| `src/utils/tierVisibility.ts` | 根据地图缩放决定 L4/L3/L2 是否显示 |

---

### 6.3 CSV 字段如何映射到前端 Place

`all_tiered_dataset.csv/json` 中的字段会在 `src/data/places.ts` 中转换成前端统一的 `Place` 对象。

主要映射关系如下：

| 数据集字段 | 前端字段 | 用途 |
|---|---|---|
| `分类` | `type` / `categoryLabel` | 分类筛选、marker 颜色、卡片标签 |
| `等级` | `tierLevel` | L4/L3/L2 缩放显示规则 |
| `POI_ID` | `poiId` | 原始 POI 标识 |
| `名称` | `name` | marker tooltip、卡片标题、路线点名称 |
| `子类` + `地址` | `subtitle` | 卡片副标题 |
| `简介/用途` | `summary` / `history` | 卡片简介和详情 |
| `标签` | `tags` | 卡片标签、推荐语义 |
| `经度` | `position.lng` | 地图坐标 |
| `纬度` | `position.lat` | 地图坐标 |
| `开放/服务时间` | `openTime` | 卡片事实信息 |
| `价格/费用/余量` | `price` | 卡片事实信息 |
| `评分` | `score` | 卡片评分展示 |
| `电话` | `phone` | 卡片联系方式 |
| `图片URL` | `imageUrl` | 卡片图片 |
| `动态字段` | `dynamicText` | 余房、容量、动态估算等说明 |
| `备注` | `notice` | 数据质量或运营提醒 |
| `建议游览分钟` | `duration` / `routeMeta.recommendedStayMinutes` | 路线时间估算 |

前端内部的 `PlaceType` 与中文分类映射：

| 中文分类 | 前端 type |
|---|---|
| 景点 | `attraction` |
| 美食 | `food` |
| 酒店 | `hotel` |
| 医院 | `hospital` |
| 停车场 | `parking` |
| 公安/警务点 | `police` |
| 卫生间 | `toilet` |

当前前端 UI 暂未直接展示 `full_poi_dataset.csv` 中的公交站、充电站。如果后续要加入，需要扩展 `PlaceType`、分类按钮、marker 样式和数据转换逻辑。

---

### 6.4 分类按钮如何工作

顶部分类按钮在：

```text
src/components/TopBar.tsx
```

当前分类顺序：

```ts
const filterOrder: PlaceType[] = [
  "attraction",
  "food",
  "hotel",
  "hospital",
  "parking",
  "police",
  "toilet",
];
```

`App.tsx` 中维护当前启用的分类：

```ts
const [activeTypes, setActiveTypes] = useState<PlaceType[]>(allPlaceTypes);
```

点击按钮时，会调用：

```ts
function toggleType(type: PlaceType) {
  setActiveTypes((current) => {
    if (current.includes(type)) {
      return current.filter((item) => item !== type);
    }
    return [...current, type];
  });
}
```

地图实际收到的是过滤后的：

```ts
const visiblePlaces = places.filter((place) => activeTypes.includes(place.type));
```

因此：

```text
点击“景点”按钮 -> activeTypes 删除/添加 attraction -> visiblePlaces 变化 -> 地图 marker 重新渲染。
```

---

### 6.5 L4/L3/L2 如何控制地图显示

缩放分层逻辑在：

```text
src/utils/tierVisibility.ts
```

核心函数：

```ts
filterPlacesByZoom(places, zoom, minZoom, maxZoom)
```

高德地图中调用位置：

```text
src/components/AmapChangshuMap.tsx
```

当前参数：

```ts
filterPlacesByZoom(visiblePlaces, mapZoom, 10, 18)
```

备用轻量地图中调用位置：

```text
src/components/FallbackChangshuMap.tsx
```

当前参数：

```ts
filterPlacesByZoom(visiblePlaces, mapZoom, 10, 15)
```

#### 有 L4 的类别

包括：

```text
景点、美食、酒店、医院
```

显示规则：

```text
低缩放：只显示 L4
中缩放：显示 L4 + L3
高缩放：显示 L4 + L3 + L2
```

高德地图缩放范围为 10-18，三等分后：

```text
10 - 12.67：只显示 L4
12.67 - 15.33：显示 L4 + L3
15.33 - 18：显示 L4 + L3 + L2
```

因此，景点/美食/酒店/医院的 L3 大约在：

```text
zoom >= 13
```

开始显示。

#### 无 L4 的类别

包括：

```text
停车场、公安/警务点、卫生间
```

显示规则：

```text
低缩放：显示 L3
高缩放：显示 L3 + L2
```

高德地图缩放范围为 10-18，二等分后：

```text
10 - 14：只显示 L3
14 - 18：显示 L3 + L2
```

因此，停车场、公安/警务点、卫生间的 L3 从最低缩放层就显示。

---

### 6.6 地图 marker 如何使用分类和等级

地图 marker 的类别颜色来自 `place.type`：

```tsx
<button className={`map-marker type-${place.type} tier-${place.tierLevel.toLowerCase()}`}>
```

其中：

```text
type-attraction -> 景点颜色
type-food       -> 美食颜色
type-hotel      -> 酒店颜色
type-hospital   -> 医院颜色
type-parking    -> 停车场颜色
type-police     -> 公安/警务点颜色
type-toilet     -> 卫生间颜色
```

等级样式来自：

```text
tier-l4
tier-l3
tier-l2
```

当前视觉规则：

```text
L4：最大，边框更强，适合核心点位
L3：中等，适合重要点位
L2：略小，适合补充点位
```

这样地图上同时表达两类信息：

```text
颜色 = 类别
大小/标签 = L 等级
```

---

### 6.7 图片字段如何在前端使用

`图片URL` 字段会映射为：

```ts
place.imageUrl
```

卡片组件位置：

```text
src/components/PlaceCard.tsx
```

卡片图片优先级：

```text
1. 使用 place.imageUrl
2. 如果没有图片，则使用当前类别的默认视觉背景
```

对于未匹配到真实图片的 L3/L4 数据，当前使用本地古风示意图：

```text
/map-skins/guli-ancient-town.png
```

这意味着前端可以直接显示，无需再判断远程图片是否存在。

---

### 6.8 路线规划如何使用数据

路线规划使用的是 `places` 中被用户加入行程的点位。

相关文件：

| 文件 | 作用 |
|---|---|
| `src/components/ItineraryPanel.tsx` | 右侧路线规划面板 |
| `src/utils/itineraryRoute.ts` | 预估距离和时间 |
| `src/utils/routePlanner.ts` | 随机路线、预设路线、游览时长估算 |
| `src/map/amapRouteService.ts` | 调用高德步行/骑行/驾车路线规划 |
| `src/data/routes.ts` | 预设路线 ID 列表 |

路线估算主要使用：

```text
经度
纬度
建议游览分钟
名称
分类
```

当用户把卡片加入路线后：

```text
place.id -> itineraryIds -> itineraryPlaces -> routePlan
```

如果高德路线服务可用：

```text
使用高德 Walking / Riding / Driving 规划真实道路路线
```

如果不可用：

```text
使用点对点直线预览路线，并保留距离和时间估算
```

---

### 6.9 地图皮肤如何影响数据展示

当前前端支持“地图皮肤调色盘”，配置位置：

```text
src/data/mapPalettes.ts
```

皮肤切换会联动：

```text
高德底图 style
点位类别颜色
路线颜色
按钮和标签强调色
右侧路线规划框强调色
```

但它不改变数据库内容。也就是说：

```text
数据库中的 分类 / 等级 / 坐标 / 图片 不变；
皮肤只改变前端如何渲染这些数据。
```

---

### 6.10 为什么 full_poi_dataset.csv 不直接全部加载到前端地图

`full_poi_dataset.csv` 有 2279 条数据，且包含公交站、充电站等扩展类别。如果直接全部可视化，会出现：

```text
1. marker 严重堆叠，地图不可读。
2. 首屏加载和重绘压力更大。
3. 公共服务类点位数量过多，会淹没景点和路线规划主线。
4. 部分类别尚未设计 UI 图标、颜色和筛选按钮。
```

因此当前推荐做法是：

```text
前端主地图：使用 all_tiered_dataset.csv/json
后端检索、补充筛选、重新标注：使用 full_poi_dataset.csv
```

如果后续要把全量库接入前端，建议采用以下方式，而不是一次性全部显示：

```text
1. 根据用户搜索关键词按需查询。
2. 根据地图视野 bbox 查询附近点。
3. 按类别分页加载。
4. 对全量 POI 做聚合点或热力层。
5. 从 full_poi_dataset.csv 中筛选新的 L4/L3/L2 后，再合入 all_tiered_dataset.csv。
```

---

### 6.11 更新数据后前端如何同步

如果只更新了 CSV，前端不会自动变化。当前前端读取的是：

```text
src/data/all_tiered_dataset.json
```

因此更新流程应为：

```text
1. 修改或生成 all_tiered_dataset.csv
2. 同步生成 all_tiered_dataset.json
3. 复制 JSON 到 changshu-master/src/data/all_tiered_dataset.json
4. 重新运行前端构建或刷新开发服务器
```

当前前端构建命令：

```powershell
D:\Nodejs\npm.cmd run build
```

开发运行命令示例：

```powershell
D:\Nodejs\npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

---

### 6.12 如果要新增一个前端类别

例如希望把 `full_poi_dataset.csv` 中的 `充电站` 加入地图，需要做这些改动：

```text
1. 在 src/types/place.ts 中扩展 PlaceType，例如增加 charging。
2. 在 src/data/places.ts 中增加中文分类到 PlaceType 的映射。
3. 在 src/components/TopBar.tsx 中增加分类按钮。
4. 在 src/styles/global.css 中增加 type-charging 的颜色和卡片样式。
5. 在 src/utils/tierVisibility.ts 中决定它是否有 L4，以及缩放显示规则。
6. 在数据集中给充电站标注 L3/L2 或 L4/L3/L2。
```

不建议直接把 full_poi_dataset.csv 中某类原样加入前端，应先筛选典型数据并标注等级。
