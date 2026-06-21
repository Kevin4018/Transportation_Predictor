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

type YelpSort = "recommended" | "rating" | "review_count";

interface SerpYelpResult {
  place_ids?: string[];
  title?: string;
  link?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  categories?: Array<{ title?: string }>;
  phone?: string;
  snippet?: string;
  thumbnail?: string;
}

interface SerpYelpResponse {
  organic_results?: SerpYelpResult[];
  error?: string;
}

export async function searchYelpRecommendations({
  query,
  location,
  sortBy = "rating",
}: {
  query: string;
  location: string;
  sortBy?: YelpSort;
}): Promise<YelpRecommendation[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "yelp");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("find_desc", query);
  url.searchParams.set("find_loc", location);
  url.searchParams.set("sortby", sortBy);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpApi Yelp search failed with status ${response.status}`);
  }

  const data = await response.json() as SerpYelpResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  return (data.organic_results ?? [])
    .map((result) => ({
      id: result.place_ids?.[0] ?? result.place_ids?.[1] ?? result.link ?? result.title ?? "",
      name: result.title ?? "Unknown place",
      url: result.link,
      rating: typeof result.rating === "number" ? result.rating : undefined,
      reviews: typeof result.reviews === "number" ? result.reviews : undefined,
      price: result.price,
      categories: result.categories?.map((category) => category.title ?? "").filter(Boolean) ?? [],
      phone: result.phone,
      snippet: result.snippet,
      thumbnail: result.thumbnail,
    }))
    .filter((result) => result.id && result.name !== "Unknown place")
    .slice(0, 5);
}
