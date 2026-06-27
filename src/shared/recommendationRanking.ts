export type RecommendationLanguage = "en" | "zh" | "fr";

export type RecommendationSourceConfidence =
  | "high"
  | "medium"
  | "low"
  | "needs_confirmation";

export type RecommendationKind = "shopping" | "food" | "places" | "plan";

export type RecommendationScenario =
  | "gas"
  | "attraction"
  | "photo_service"
  | "route"
  | "shopping"
  | "food"
  | "general";

export type RecommendationWeights = {
  distance?: number;
  travelTime?: number;
  price?: number;
  rating?: number;
  open?: number;
  confidence?: number;
};

export interface RecommendationCandidate {
  name?: string;
  distanceKm?: number;
  travelTimeMin?: number;
  driveTimeMin?: number;
  price?: string;
  priceLevel?: string;
  rating?: number;
  openNow?: boolean;
  sourceConfidence?: RecommendationSourceConfidence;
  categories?: string[];
  category?: string;
  budget?: "free" | "low" | "medium" | "higher";
  note?: string;
}

export type RankedRecommendationCandidate<T extends RecommendationCandidate> = T & {
  recommendationScore: number;
  recommendationReasons: string[];
};

const RECOMMENDATION_WEIGHTS: Record<RecommendationScenario, RecommendationWeights> = {
  gas: { price: 0.45, distance: 0.3, open: 0.15, confidence: 0.1 },
  attraction: { open: 0.25, travelTime: 0.25, price: 0.2, rating: 0.2, confidence: 0.1 },
  photo_service: { price: 0.3, rating: 0.25, distance: 0.2, open: 0.15, confidence: 0.1 },
  route: { travelTime: 0.45, distance: 0.25, price: 0.1, rating: 0.1, confidence: 0.1 },
  shopping: { distance: 0.25, rating: 0.25, price: 0.2, open: 0.2, confidence: 0.1 },
  food: { rating: 0.35, distance: 0.2, price: 0.15, open: 0.2, confidence: 0.1 },
  general: { distance: 0.25, travelTime: 0.25, price: 0.2, rating: 0.15, open: 0.1, confidence: 0.05 },
};

export function inferRecommendationScenario(
  input: string,
  kind: RecommendationKind | undefined,
  candidates: RecommendationCandidate[],
): RecommendationScenario {
  const text = input.toLowerCase();
  const categories = candidates
    .flatMap(candidate => [...(candidate.categories ?? []), candidate.category ?? ""])
    .join(" ")
    .toLowerCase();

  if (/gas|fuel|加油|油价/.test(text) || /gas_station|gas/.test(categories)) return "gas";
  if (/photo|passport|studio|照相|证件照|摄影/.test(text) || /photo/.test(categories)) return "photo_service";
  if (/route|navigate|transit|drive|walk|bike|路线|怎么去|导航/.test(text) || kind === "plan") return "route";
  if (/restaurant|food|lunch|dinner|coffee|吃|餐厅|美食/.test(text) || kind === "food") return "food";
  if (/museum|gallery|zoo|park|attraction|amusement|ticket|玩|景点|博物馆|游乐园|门票/.test(text) || /attractions|culture|parks/.test(categories)) return "attraction";
  if (/shop|store|mall|supermarket|grocery|retail|买|商店|超市|购物/.test(text) || kind === "shopping") return "shopping";
  return "general";
}

export function getWeightsFromRecommendationIntent(
  input: string,
  kind: RecommendationKind | undefined,
  candidates: RecommendationCandidate[],
): RecommendationWeights {
  return RECOMMENDATION_WEIGHTS[inferRecommendationScenario(input, kind, candidates)];
}

function lowerIsBetterScore(value: number | undefined, fallback = 55): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  if (value <= 1) return 100;
  if (value <= 3) return 85;
  if (value <= 5) return 70;
  if (value <= 10) return 50;
  if (value <= 20) return 35;
  return 25;
}

function travelTimeScore(minutes: number | undefined): number {
  if (minutes === undefined || !Number.isFinite(minutes)) return 55;
  if (minutes <= 10) return 100;
  if (minutes <= 20) return 85;
  if (minutes <= 35) return 70;
  if (minutes <= 55) return 50;
  return 30;
}

function numericPrice(candidate: RecommendationCandidate): number | undefined {
  if (candidate.budget === "free") return 0;
  if (candidate.budget === "low") return 1;
  if (candidate.budget === "medium") return 2;
  if (candidate.budget === "higher") return 3;
  const price = candidate.price ?? candidate.priceLevel ?? "";
  const dollars = price.match(/\$/g)?.length;
  if (dollars && dollars > 0) return dollars;
  const number = price.match(/\d+(?:\.\d+)?/)?.[0];
  return number ? Number(number) : undefined;
}

export function priceRank(candidate: RecommendationCandidate): number {
  const numeric = numericPrice(candidate);
  return numeric ?? 9;
}

function priceScore(
  candidate: RecommendationCandidate,
  minPrice: number | undefined,
  maxPrice: number | undefined,
): number {
  const price = numericPrice(candidate);
  if (price === undefined || minPrice === undefined || maxPrice === undefined) return 55;
  if (maxPrice === minPrice) return 80;
  return Math.max(0, Math.min(100, 100 - ((price - minPrice) / (maxPrice - minPrice)) * 100));
}

function ratingScore(rating: number | undefined): number {
  if (rating === undefined || !Number.isFinite(rating)) return 50;
  return Math.max(0, Math.min(100, (rating / 5) * 100));
}

function openScore(openNow: boolean | undefined): number {
  if (openNow === false) return 0;
  if (openNow === true) return 100;
  return 50;
}

function confidenceScore(confidence: RecommendationSourceConfidence | undefined): number {
  if (confidence === "high") return 100;
  if (confidence === "medium") return 70;
  if (confidence === "low") return 40;
  if (confidence === "needs_confirmation") return 30;
  return 55;
}

function weightedScore(scores: RecommendationWeights, weights: RecommendationWeights): number {
  const entries = Object.entries(weights) as Array<[keyof RecommendationWeights, number]>;
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const total = entries.reduce((sum, [key, weight]) => sum + ((scores[key] ?? 55) * weight), 0);
  return Math.round(total / totalWeight);
}

function recommendationReasons(
  candidate: RecommendationCandidate,
  scores: RecommendationWeights,
  language: RecommendationLanguage,
): string[] {
  const reasons: string[] = [];
  const add = (en: string, zh: string, fr: string) => {
    reasons.push(language === "zh" ? zh : language === "fr" ? fr : en);
  };

  if ((scores.open ?? 0) >= 90) add("open now", "现在营业", "ouvert maintenant");
  if ((scores.distance ?? 0) >= 80 && candidate.distanceKm !== undefined) add("close by", "距离近", "près de vous");
  if ((scores.travelTime ?? 0) >= 80 && (candidate.travelTimeMin ?? candidate.driveTimeMin) !== undefined) {
    add("short travel time", "交通时间短", "trajet court");
  }
  if ((scores.price ?? 0) >= 80 && (candidate.price || candidate.priceLevel || candidate.budget)) {
    add("budget-friendly", "价格/预算友好", "bon pour le budget");
  }
  if ((scores.rating ?? 0) >= 85 && candidate.rating !== undefined) add("highly rated", "评分高", "bien noté");
  if ((scores.confidence ?? 0) >= 70) add("reliable source signal", "来源可信度较高", "source plutôt fiable");
  if (reasons.length === 0 && candidate.note) reasons.push(candidate.note);

  return reasons.slice(0, 3);
}

export function rankCandidates<T extends RecommendationCandidate>(
  candidates: T[],
  options: {
    input?: string;
    kind?: RecommendationKind;
    language?: RecommendationLanguage;
    weights?: RecommendationWeights;
  } = {},
): Array<RankedRecommendationCandidate<T>> {
  const weights = options.weights ??
    getWeightsFromRecommendationIntent(options.input ?? "", options.kind, candidates);
  const prices = candidates.map(numericPrice).filter((value): value is number => value !== undefined);
  const minPrice = prices.length ? Math.min(...prices) : undefined;
  const maxPrice = prices.length ? Math.max(...prices) : undefined;
  const language = options.language ?? "en";

  return candidates
    .map(candidate => {
      const scores: RecommendationWeights = {
        distance: lowerIsBetterScore(candidate.distanceKm),
        travelTime: travelTimeScore(candidate.travelTimeMin ?? candidate.driveTimeMin),
        price: priceScore(candidate, minPrice, maxPrice),
        rating: ratingScore(candidate.rating),
        open: openScore(candidate.openNow),
        confidence: confidenceScore(candidate.sourceConfidence),
      };

      return {
        ...candidate,
        recommendationScore: weightedScore(scores, weights),
        recommendationReasons: recommendationReasons(candidate, scores, language),
      };
    })
    .sort((a, b) =>
      b.recommendationScore - a.recommendationScore ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      (a.distanceKm ?? 999) - (b.distanceKm ?? 999),
    );
}
