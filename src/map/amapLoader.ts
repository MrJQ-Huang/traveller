declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
  }
}

let loadingPromise: Promise<any> | null = null;

export type AmapConfig = {
  key: string;
  securityCode?: string;
};

export function getAmapConfig(): AmapConfig | null {
  const key = import.meta.env.VITE_AMAP_KEY as string | undefined;
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined;

  if (!key) {
    return null;
  }

  return {
    key,
    securityCode,
  };
}

export function getAmapStyle(): string {
  return (import.meta.env.VITE_AMAP_STYLE as string | undefined) || "amap://styles/normal";
}

export function loadAmap(config: AmapConfig): Promise<any> {
  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  if (config.securityCode) {
    window._AMapSecurityConfig = {
      securityJsCode: config.securityCode,
    };
  }

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const plugins = [
      "AMap.Scale",
      "AMap.ToolBar",
      "AMap.Walking",
      "AMap.Driving",
      "AMap.Riding",
      "AMap.DistrictSearch",
      "AMap.Weather",
      "AMap.Geolocation",
      "AMap.Geocoder",
      "AMap.PlaceSearch",
    ].join(",");

    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
      config.key,
    )}&plugin=${encodeURIComponent(plugins)}`;
    script.async = true;
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
        return;
      }

      reject(new Error("AMap script loaded but window.AMap is unavailable."));
    };
    script.onerror = () => reject(new Error("Failed to load AMap script."));
    document.head.appendChild(script);
  });

  return loadingPromise;
}
