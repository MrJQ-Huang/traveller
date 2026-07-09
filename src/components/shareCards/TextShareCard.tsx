export type TextCardStylePresetId =
  | "lake"
  | "sunset"
  | "lotus"
  | "night"
  | "bamboo"
  | "mist"
  | "market"
  | "garden"
  | "tea"
  | "ink"
  | "card1"
  | "card2"
  | "card3";

export type TextCardDraft = {
  title: string;
  body: string;
  tags: string;
  location: string;
  author: string;
  titleIndex: number;
  bodyIndex: number;
  styleIndex: number;
  stylePresetId: TextCardStylePresetId;
  styleName: string;
  fontClassName: string;
  layoutClassName: string;
  backgroundUrl?: string;
  iconUrl: string;
  iconClassName: string;
  usesImageBackground?: boolean;
};

type TextShareCardProps = {
  draft: TextCardDraft;
};

function splitTags(tags: string) {
  return tags
    .split(/[，,\s#]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function TextShareCard({ draft }: TextShareCardProps) {
  const tags = splitTags(draft.tags);
  const className = [
    "share-card",
    "text-share-card",
    `theme-${draft.stylePresetId}`,
    draft.fontClassName,
    draft.layoutClassName,
    draft.usesImageBackground ? "has-image-background" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className}>
      {draft.backgroundUrl && (
        <>
          <img className="text-card-bg-image" src={draft.backgroundUrl} alt="" />
          <div className="text-card-bg-scrim" />
        </>
      )}
      <img className={`text-card-deco-icon ${draft.iconClassName}`} src={draft.iconUrl} alt="" />

      <div className="paper-grain" />
      <div className="share-sticker sticker-lake">水乡慢游</div>
      <div className="share-sticker sticker-note">{draft.styleName}</div>
      <div className="ink-cloud cloud-a" />
      <div className="ink-cloud cloud-b" />

      <header className="text-card-header">
        <span>{draft.location || "常熟旅行"}</span>
        <h1>{draft.title || "写下你的常熟灵感"}</h1>
      </header>

      <p className="text-card-body">
        {draft.body || "把一段旅途文案放进这里，自动生成一张适合分享的文旅手绘风卡片。"}
      </p>

      <footer className="text-card-footer">
        <div className="text-card-tags">
          {(tags.length ? tags : ["常熟", "文旅", "路线灵感"]).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        <strong>{draft.author || "Changshu Travel"}</strong>
      </footer>
    </article>
  );
}
