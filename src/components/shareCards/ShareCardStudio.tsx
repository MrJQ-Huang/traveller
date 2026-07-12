import {
  Download,
  FileText,
  Link2,
  Map,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { Place } from "../../types/place";
import type { RoutePlan, TransportMode } from "../../types/route";
import { type MapSkinId } from "../../types/mapSkin";
import type { RouteSharePayload } from "../../types/shareRoute";
import { routeShareMetadataKeyword } from "../../types/shareRoute";
import { createElementPngFile, saveElementAsPng } from "../../utils/cardExport";
import { readPngTextMetadataFromFile } from "../../utils/pngMetadata";
import { RouteShareCard } from "./RouteShareCard";
import { TextShareCard, type TextCardDraft, type TextCardStylePresetId } from "./TextShareCard";

type ShareCardStudioProps = {
  open: boolean;
  routeTitle: string;
  routeDescription: string;
  places: Place[];
  routePlan: RoutePlan;
  transportMode: TransportMode;
  activeMapSkinId: MapSkinId;
  onImportRouteShare: (payload: RouteSharePayload) => void;
  onClose: () => void;
};

type ShareMode = "text" | "route";
type Platform = "qq" | "wechat" | "xiaohongshu" | "weibo";
type ShareStatus = {
  tone: "success" | "error" | "info";
  message: string;
  showSaveShortcut?: boolean;
};

type StylePreset = {
  id: TextCardStylePresetId;
  name: string;
  fontClassName: string;
  layoutClassName: string;
  backgroundUrl?: string;
  iconUrl: string;
  iconClassName: string;
  usesImageBackground?: boolean;
};

const assetBase = "/card-backgrounds/text-cards";

const titlePool = [
  "今日路线灵感",
  "把晨光装进路线",
  "松弛感小旅行",
  "沿着城市慢慢走",
  "今天只想慢慢发呆",
  "去路上收集一点温柔",
  "半日山水半日烟火",
  "城市手账路线",
  "从老街走到湖风里",
  "写给旅途的慢慢喜欢",
];

const bodyPool = [
  "从晨光、街角和一顿热饭开始，把城市的风景和烟火气收进一天。",
  "在树影里放慢脚步，再去水边等一阵风，一座城市很适合慢慢喜欢。",
  "把园林、老街和茶香串成一条轻路线，走到哪里都像翻开一页江南手账。",
  "不用赶路，也不急着打卡，跟着街巷和转角前进，就能遇见旅途的温柔。",
  "白天看山水，傍晚尝烟火，夜里把今天的好心情写进一张旅行卡片。",
  "从一条石板路走进小城日常，让茶香、桥影和晚霞替你写下旅途注脚。",
  "把行程排得松一点，留时间给风、给树影，也给突然想停下来的自己。",
  "旅途的好不吵闹，藏在一段风景、一条街巷和一口热乎的本地味道里。",
  "适合和朋友慢慢走，也适合一个人慢慢看，把今天过成一页温柔便签。",
  "让路线不只是打卡清单，而是从山水到烟火、从白天到夜色的一段小故事。",
];

const stylePresets: StylePreset[] = [
  {
    id: "lake",
    name: "江南湖绿",
    fontClassName: "font-kaiti",
    layoutClassName: "layout-classic",
    iconUrl: `${assetBase}/icon1.png`,
    iconClassName: "icon-tint-lake",
  },
  {
    id: "sunset",
    name: "夕照橙红",
    fontClassName: "font-poster",
    layoutClassName: "layout-bold",
    iconUrl: `${assetBase}/icon2.png`,
    iconClassName: "icon-tint-sunset",
  },
  {
    id: "lotus",
    name: "荷粉青黛",
    fontClassName: "font-song",
    layoutClassName: "layout-notebook",
    iconUrl: `${assetBase}/icon1.png`,
    iconClassName: "icon-tint-lotus",
  },
  {
    id: "night",
    name: "夜蓝金墨",
    fontClassName: "font-poster",
    layoutClassName: "layout-left-rail",
    iconUrl: `${assetBase}/icon3.png`,
    iconClassName: "icon-tint-night",
  },
  {
    id: "bamboo",
    name: "竹影青绿",
    fontClassName: "font-kaiti",
    layoutClassName: "layout-left-rail",
    iconUrl: `${assetBase}/icon1.png`,
    iconClassName: "icon-tint-bamboo",
  },
  {
    id: "mist",
    name: "烟雨灰青",
    fontClassName: "font-song",
    layoutClassName: "layout-classic",
    iconUrl: `${assetBase}/icon3.png`,
    iconClassName: "icon-tint-mist",
  },
  {
    id: "market",
    name: "市集暖黄",
    fontClassName: "font-round",
    layoutClassName: "layout-notebook",
    iconUrl: `${assetBase}/icon2.png`,
    iconClassName: "icon-tint-market",
  },
  {
    id: "garden",
    name: "园林黛紫",
    fontClassName: "font-song",
    layoutClassName: "layout-bold",
    iconUrl: `${assetBase}/icon3.png`,
    iconClassName: "icon-tint-garden",
  },
  {
    id: "tea",
    name: "茶香米白",
    fontClassName: "font-round",
    layoutClassName: "layout-classic",
    iconUrl: `${assetBase}/icon1.png`,
    iconClassName: "icon-tint-tea",
  },
  {
    id: "ink",
    name: "水墨黑白",
    fontClassName: "font-kaiti",
    layoutClassName: "layout-left-rail",
    iconUrl: `${assetBase}/icon3.png`,
    iconClassName: "icon-tint-ink",
  },
  {
    id: "card1",
    name: "粉雾湖光",
    fontClassName: "font-song",
    layoutClassName: "layout-image-safe",
    backgroundUrl: `${assetBase}/card1.png`,
    iconUrl: `${assetBase}/icon1.png`,
    iconClassName: "icon-tint-card1",
    usesImageBackground: true,
  },
  {
    id: "card2",
    name: "清亮手账",
    fontClassName: "font-round",
    layoutClassName: "layout-image-safe",
    backgroundUrl: `${assetBase}/card2.png`,
    iconUrl: `${assetBase}/icon2.png`,
    iconClassName: "icon-tint-card2",
    usesImageBackground: true,
  },
  {
    id: "card3",
    name: "暖调拼贴",
    fontClassName: "font-kaiti",
    layoutClassName: "layout-image-safe",
    backgroundUrl: `${assetBase}/card3.png`,
    iconUrl: `${assetBase}/icon3.png`,
    iconClassName: "icon-tint-card3",
    usesImageBackground: true,
  },
];

const platformMeta: Record<Platform, { hintName: string }> = {
  qq: { hintName: "QQ" },
  wechat: { hintName: "微信" },
  xiaohongshu: { hintName: "小红书" },
  weibo: { hintName: "微博" },
};

function randomIndex(length: number) {
  return Math.floor(Math.random() * length);
}

function buildTextDraft(titleIndex: number, bodyIndex: number, styleIndex: number): TextCardDraft {
  const style = stylePresets[styleIndex];

  return {
    title: titlePool[titleIndex],
    body: bodyPool[bodyIndex],
    tags: "路线 灵感 地图 周末出发",
    location: "我的路线",
    author: "Route Playbook",
    titleIndex,
    bodyIndex,
    styleIndex,
    stylePresetId: style.id,
    styleName: style.name,
    fontClassName: style.fontClassName,
    layoutClassName: style.layoutClassName,
    backgroundUrl: style.backgroundUrl,
    iconUrl: style.iconUrl,
    iconClassName: style.iconClassName,
    usesImageBackground: style.usesImageBackground,
  };
}

function createRandomTextDraft() {
  return buildTextDraft(randomIndex(titlePool.length), randomIndex(bodyPool.length), randomIndex(stylePresets.length));
}

function applyStylePreset(draft: TextCardDraft, styleIndex: number): TextCardDraft {
  const style = stylePresets[styleIndex];

  return {
    ...draft,
    styleIndex,
    stylePresetId: style.id,
    styleName: style.name,
    fontClassName: style.fontClassName,
    layoutClassName: style.layoutClassName,
    backgroundUrl: style.backgroundUrl,
    iconUrl: style.iconUrl,
    iconClassName: style.iconClassName,
    usesImageBackground: style.usesImageBackground,
  };
}

function canShareFile(file: File) {
  const nav = navigator as Navigator & {
    share?: (data?: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  return typeof nav.share === "function" && Boolean(nav.canShare?.({ files: [file] }));
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function ShareCardStudio({
  open,
  routeTitle,
  routeDescription,
  places,
  routePlan,
  transportMode,
  activeMapSkinId,
  onImportRouteShare,
  onClose,
}: ShareCardStudioProps) {
  const [mode, setMode] = useState<ShareMode>("text");
  const [textDraft, setTextDraft] = useState<TextCardDraft>(() => createRandomTextDraft());
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTextDraft(createRandomTextDraft());
    setShareStatus(null);
  }, [open]);

  if (!open) return null;

  const fileName = mode === "text" ? "changshu-note-card.png" : "changshu-route-card.png";
  const shareTitle = mode === "text" ? textDraft.title : routeTitle || "我的路线";

  function buildRouteSharePayload(): RouteSharePayload {
    return {
      schema: "changshu-route-share",
      version: 1,
      exportedAt: new Date().toISOString(),
      title: routeTitle,
      description: routeDescription,
      placeIds: places.map((place) => place.id),
      places,
      routePlan,
      transportMode,
      mapSkinId: activeMapSkinId,
    };
  }

  function getRouteShareMetadata() {
    if (mode !== "route") {
      return undefined;
    }

    return {
      keyword: routeShareMetadataKeyword,
      value: JSON.stringify(buildRouteSharePayload()),
    };
  }

  function cycleTitle() {
    setTextDraft((draft) => {
      const titleIndex = (draft.titleIndex + 1) % titlePool.length;
      return { ...draft, titleIndex, title: titlePool[titleIndex] };
    });
  }

  function cycleBody() {
    setTextDraft((draft) => {
      const bodyIndex = (draft.bodyIndex + 1) % bodyPool.length;
      return { ...draft, bodyIndex, body: bodyPool[bodyIndex] };
    });
  }

  function cycleStyle() {
    setTextDraft((draft) => applyStylePreset(draft, (draft.styleIndex + 1) % stylePresets.length));
  }

  async function withCardGeneration(action: (element: HTMLElement) => Promise<void>) {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      await action(cardRef.current);
    } catch (error) {
      console.error("Share card generation failed", error);
      setShareStatus({
        tone: "error",
        message: "生成失败，请重试或先保存图片",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    await withCardGeneration(async (element) => {
      await saveElementAsPng(element, fileName, getRouteShareMetadata());
      setShareStatus({
        tone: "success",
        message: "图片已保存",
      });
    });
  }

  async function handleCopyLink() {
    try {
      await copyText(window.location.href);
      setShareStatus({
        tone: "success",
        message: "链接已复制",
      });
    } catch {
      setShareStatus({
        tone: "error",
        message: "复制失败，请手动复制浏览器地址",
      });
    }
  }

  async function handlePlatformShare(platform: Platform) {
    await withCardGeneration(async (element) => {
      const meta = platformMeta[platform];
      const file = await createElementPngFile(element, fileName, getRouteShareMetadata());

      if (canShareFile(file)) {
        try {
          await navigator.share({
            title: shareTitle,
            text: `${shareTitle}｜路线分享卡片`,
            files: [file],
          });
          setShareStatus({
            tone: "success",
            message: "已调用系统分享",
          });
          return;
        } catch {
          // Fall through to the platform-specific compatible hint.
        }
      }

      if (platform === "weibo") {
        const url = new URL("https://service.weibo.com/share/share.php");
        url.searchParams.set("title", `${shareTitle}｜路线分享卡片`);
        url.searchParams.set("url", window.location.href);
        window.open(url.toString(), "_blank", "noopener,noreferrer");
        setShareStatus({
          tone: "info",
          message: "已打开微博分享页，请手动添加刚保存的图片",
          showSaveShortcut: true,
        });
        return;
      }

      setShareStatus({
        tone: "info",
        message: `图片已生成，请保存后分享到${meta.hintName}`,
        showSaveShortcut: true,
      });
    });
  }

  async function handleImportRouteImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const metadata = await readPngTextMetadataFromFile(file, routeShareMetadataKeyword);
      if (!metadata) {
        setShareStatus({
          tone: "error",
          message: "这张图片里没有可导入的路线方案",
        });
        return;
      }

      const payload = JSON.parse(metadata) as RouteSharePayload;
      if (
        payload.schema !== "changshu-route-share" ||
        payload.version !== 1 ||
        !Array.isArray(payload.placeIds)
      ) {
        throw new Error("Invalid route share payload");
      }

      onImportRouteShare(payload);
      setMode("route");
      setShareStatus({
        tone: "success",
        message: "已导入路线方案，右侧行程和地图已更新",
      });
    } catch (error) {
      console.error("Route image import failed", error);
      setShareStatus({
        tone: "error",
        message: "导入失败，请选择由本 Demo 生成的路线卡片原图",
      });
    }
  }

  return (
    <div className="share-studio-backdrop" role="dialog" aria-modal="true" aria-label="分享卡片生成器">
      <section className="share-studio">
        <header className="share-studio-header">
          <div>
            <span className="eyebrow">分享卡片</span>
            <h2>生成社交传播图</h2>
          </div>
          <button className="ghost-icon-button" type="button" onClick={onClose} aria-label="关闭分享卡片">
            <X size={18} />
          </button>
        </header>

        <div className="share-studio-tabs" aria-label="卡片类型">
          <button className={mode === "text" ? "is-active" : ""} type="button" onClick={() => setMode("text")}>
            <FileText size={16} />
            文字卡片
          </button>
          <button className={mode === "route" ? "is-active" : ""} type="button" onClick={() => setMode("route")}>
            <Map size={16} />
            路线卡片
          </button>
        </div>

        <div className="share-studio-body">
          <aside className="share-editor">
            <div className="share-editor-scroll">
              {mode === "text" ? (
                <>
                  <div className="share-field">
                    <div className="share-field-header">
                      <span>标题</span>
                      <button type="button" onClick={cycleTitle} aria-label="切换标题">
                        <RefreshCw size={15} />
                      </button>
                    </div>
                    <input
                      value={textDraft.title}
                      onChange={(event) => setTextDraft((draft) => ({ ...draft, title: event.target.value }))}
                    />
                  </div>
                  <div className="share-field">
                    <div className="share-field-header">
                      <span>正文</span>
                      <button type="button" onClick={cycleBody} aria-label="切换正文">
                        <RefreshCw size={15} />
                      </button>
                    </div>
                    <textarea
                      rows={7}
                      value={textDraft.body}
                      onChange={(event) => setTextDraft((draft) => ({ ...draft, body: event.target.value }))}
                    />
                  </div>
                  <div className="share-field">
                    <div className="share-field-header">
                      <span>风格</span>
                      <button type="button" onClick={cycleStyle} aria-label="切换风格">
                        <RefreshCw size={15} />
                      </button>
                    </div>
                    <div className="style-readout">{textDraft.styleName}</div>
                  </div>
                  <label>
                    标签
                    <input
                      value={textDraft.tags}
                      onChange={(event) => setTextDraft((draft) => ({ ...draft, tags: event.target.value }))}
                    />
                  </label>
                  <label>
                    地点
                    <input
                      value={textDraft.location}
                      onChange={(event) => setTextDraft((draft) => ({ ...draft, location: event.target.value }))}
                    />
                  </label>
                  <label>
                    署名
                    <input
                      value={textDraft.author}
                      onChange={(event) => setTextDraft((draft) => ({ ...draft, author: event.target.value }))}
                    />
                  </label>
                </>
              ) : (
                <div className="route-card-editor-note">
                  <strong>路线卡片使用当前行程</strong>
                  <p>请先在地图上选择或生成路线。卡片会读取当前站点顺序、路线标题、距离和预计用时。</p>
                  <span>{places.length ? `当前已选择 ${places.length} 个站点` : "当前还没有选择站点"}</span>
                </div>
              )}

              <div className="share-actions">
                <input
                  ref={importInputRef}
                  className="share-import-input"
                  type="file"
                  accept="image/png"
                  onChange={handleImportRouteImage}
                />
                <button
                  className="share-action-button share-action-primary"
                  type="button"
                  onClick={handleSave}
                  disabled={isGenerating}
                >
                  <Download size={17} />
                  {isGenerating ? "正在生成" : "保存图片"}
                </button>
                <button className="share-action-button" type="button" onClick={handleCopyLink} disabled={isGenerating}>
                  <Link2 size={17} />
                  复制链接
                </button>
                <button
                  className="share-action-button"
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isGenerating}
                >
                  <Upload size={17} />
                  导入路线图
                </button>
                <div className="share-platforms" aria-label="分享平台">
                  <button type="button" onClick={() => handlePlatformShare("qq")} disabled={isGenerating}>
                    <MessageCircle size={16} />
                    QQ
                  </button>
                  <button type="button" onClick={() => handlePlatformShare("wechat")} disabled={isGenerating}>
                    <MessageCircle size={16} />
                    微信
                  </button>
                  <button type="button" onClick={() => handlePlatformShare("xiaohongshu")} disabled={isGenerating}>
                    <Send size={16} />
                    小红书
                  </button>
                  <button type="button" onClick={() => handlePlatformShare("weibo")} disabled={isGenerating}>
                    <Share2 size={16} />
                    微博
                  </button>
                </div>
                {shareStatus && (
                  <div className={`share-status is-${shareStatus.tone}`}>
                    <span>{shareStatus.message}</span>
                    {shareStatus.showSaveShortcut && (
                      <button type="button" onClick={handleSave} disabled={isGenerating}>
                        保存图片
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="share-preview-wrap">
            <div className="share-preview-frame">
              <div className="share-preview-scale">
                <div className="share-card-export-surface" ref={cardRef}>
                  {mode === "text" ? (
                    <TextShareCard draft={textDraft} />
                  ) : (
                    <RouteShareCard
                      title={routeTitle}
                      description={routeDescription}
                      places={places}
                      routePlan={routePlan}
                      mapSkinId={activeMapSkinId}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
