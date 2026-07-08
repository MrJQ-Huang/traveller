# 常熟 Demo AI 瓦片制作包

这个目录用于制作少量 Demo 瓦片，不是全量常熟地图瓦片。

## 范围

- 虞山-老城-尚湖核心区
- 古里古镇
- zoom: 12, 13, 14
- tile size: 512x512
- tile count: 75

## 你需要产出的文件路径

```text
public/map-tiles/changshu-demo/{z}/{x}/{y}.png
```

示例：

```text
public/map-tiles/changshu-demo/12/3420/1667.png
```

## 文件说明

- `manifest.json`: 前端接入和瓦片清单使用。
- `tiles.csv`: 给制图流程、人手检查或表格工具使用。
- `source-templates/`: 每张瓦片的命名模板图。模板不是地图底图，只用于确认 z/x/y、经纬度范围和目标文件名。
- `template-png/`: PNG 命名模板，方便直接在图像处理流程中核对路径；最终成品仍需放到 `public/map-tiles/changshu-demo/`。

## 制作要求

1. 每张最终瓦片输出为 PNG。
2. 文件名必须严格保持为 `{z}/{x}/{y}.png`。
3. 不要改变瓦片尺寸，建议输出 512x512。
4. 相邻瓦片需要无缝衔接。
5. Demo 阶段只制作 manifest 内列出的瓦片。
6. 没有制作的瓦片会自动露出高德原始底图。

## 建议流程

1. 按 `tiles.csv` 获取每张瓦片对应的真实地理范围。
2. 使用合法来源的底图或自绘矢量底图生成对应区域图像。
3. 按区域或 metatile 进行统一 AI 风格化，避免逐张处理导致接缝。
4. 切回标准瓦片。
5. 按 `targetPath` 放回项目。
