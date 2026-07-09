import { toPng } from "html-to-image";

const pngOptions: NonNullable<Parameters<typeof toPng>[1]> = {
  cacheBust: true,
  pixelRatio: 2,
  backgroundColor: "#f4ead4",
  skipFonts: true,
  filter: (node: HTMLElement) => {
    if (!(node instanceof HTMLImageElement)) {
      return true;
    }

    const style = window.getComputedStyle(node);
    return style.display !== "none" && node.naturalWidth > 0 && node.naturalHeight > 0;
  },
};

export async function createElementPngDataUrl(element: HTMLElement) {
  await waitForExportAssets(element);
  return toPng(element, pngOptions);
}

export async function saveElementAsPng(element: HTMLElement, fileName: string) {
  const dataUrl = await createElementPngDataUrl(element);
  downloadDataUrl(dataUrl, fileName);
}

export async function createElementPngFile(element: HTMLElement, fileName: string) {
  const dataUrl = await createElementPngDataUrl(element);
  const blob = await dataUrlToBlob(dataUrl);
  return new File([blob], fileName, { type: "image/png" });
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function waitForExportAssets(element: HTMLElement) {
  await document.fonts?.ready.catch(() => undefined);

  const images = [...element.querySelectorAll("img")];
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) {
        return;
      }

      try {
        await image.decode();
      } catch {
        // Missing route tiles are filtered out during export.
      }
    }),
  );
}
