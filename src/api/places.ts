import { apiRequest } from "./request";

export interface YelpRecommendation {
  id: string;
  name: string;
  url?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  categories: string[];
  phone?: string;
  snippet?: string;
  thumbnail?: string;
}

export function searchYelpRecommendations({
  query,
  lat,
  lng,
  location,
}: {
  query: string;
  lat?: number;
  lng?: number;
  location?: string;
}): Promise<YelpRecommendation[]> {
  return apiRequest<YelpRecommendation[]>("/api/places/yelp/search", {
    params: { query, lat, lng, location },
  });
}
