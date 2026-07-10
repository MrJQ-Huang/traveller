import { getAmapConfig, loadAmap } from "../map/amapLoader";

export type AmapPoi = {
  name: string;
  address: string;
  type: string;
  lng: number;
  lat: number;
  phone?: string;
};

let searchInstance: any = null;
let loadPromise: Promise<any> | null = null;

async function getPlaceSearch() {
  if (searchInstance) return searchInstance;

  if (!loadPromise) {
    const config = getAmapConfig();
    if (!config) throw new Error("No AMap config");
    loadPromise = loadAmap(config).then((AMap) => {
      return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("PlaceSearch plugin timeout")), 10000);
        AMap.plugin("AMap.PlaceSearch", () => {
          window.clearTimeout(timer);
          searchInstance = new AMap.PlaceSearch({
            city: "常熟",
            citylimit: true,
            pageSize: 8,
          });
          resolve();
        });
      });
    });
  }

  await loadPromise;
  return searchInstance;
}

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function searchAmapPlaces(query: string): Promise<AmapPoi[]> {
  if (!query.trim()) return [];

  const ps = await getPlaceSearch();

  return new Promise((resolve) => {
    ps.search(query, (status: string, result: any) => {
      if (status !== "complete" || !result?.poiList?.pois) {
        resolve([]);
        return;
      }

      const pois = result.poiList.pois
        .map((poi: any) => {
          const lng = toNumber(poi.location?.lng);
          const lat = toNumber(poi.location?.lat);
          if (lng === null || lat === null) return null;
          return {
            name: String(poi.name ?? ""),
            address: String(poi.address ?? ""),
            type: String(poi.type ?? ""),
            lng,
            lat,
            phone: poi.tel ? String(poi.tel) : undefined,
          };
        })
        .filter((poi: AmapPoi | null): poi is AmapPoi => Boolean(poi));

      resolve(pois);
    });
  });
}
