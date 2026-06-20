import { apiRequest } from "./request";

export interface ConstructionEvent {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  distanceKm: number;
  delayMin: number;
  source: "geojson" | "mock";
}

export interface ConstructionImpact {
  source: "geojson" | "mock";
  constructionDelayMin: number;
  events: ConstructionEvent[];
}

export function getConstructionImpact(
  lat: number,
  lng: number,
): Promise<ConstructionImpact> {
  return apiRequest<ConstructionImpact>("/api/construction/impact", {
    params: { lat, lng },
  });
}
