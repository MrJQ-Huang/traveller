# 常熟 Demo AI 瓦片制作包

这个目录只保留真正用于 Demo AI 地图皮肤制作的内容。

## 当前内容

- `amap-source-tiles/`: 已授权导出的高德源瓦片，作为 AI 风格化处理输入。
- `amap-source-tiles-manifest.json`: 源瓦片导出记录。
- `manifest.json`: 前端后续加载 AI 瓦片时使用的标准清单。
- `tiles.csv`: 给批处理、表格检查或人工核对使用的瓦片清单。

已删除早期测试用的假瓦片模板：

- `source-templates/`
- `template-png/`

## 瓦片范围

- 区域 1: 虞山-老城-尚湖核心区
- 区域 2: 古里古镇
- zoom: 12, 13, 14
- tile count: 75
- source tile size: 256x256

## 处理输入

请使用以下目录中的真实源瓦片进行风格化处理：

```text
瓦片制作包/changshu-demo/amap-source-tiles/{z}/{x}/{y}.png
```

示例：

```text
瓦片制作包/changshu-demo/amap-source-tiles/14/13687/6672.png
```

## 处理输出

处理完成后，请保持完全相同的 `{z}/{x}/{y}.png` 结构，放回项目最终加载目录：

```text
public/map-tiles/changshu-demo/{z}/{x}/{y}.png
```

示例：

```text
public/map-tiles/changshu-demo/14/13687/6672.png
```

## 制作要求

1. 文件路径必须严格保持 `{z}/{x}/{y}.png`。
2. 第一轮建议保持 `256x256 PNG`，这样接入高德自定义瓦片层最稳。
3. 相邻瓦片需要无缝衔接。
4. 不要逐张孤立风格化，建议按区域或 metatile 统一处理后再切回瓦片。
5. 没有制作的瓦片会自动露出高德原始底图。

## 给前端接入用

前端接入时只需要读取：

```text
manifest.json
public/map-tiles/changshu-demo/{z}/{x}/{y}.png
```
