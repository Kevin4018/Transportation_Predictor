import { Router } from "express";

import { searchYelpRecommendations } from "../services/serpYelpService";

const router = Router();

const parseNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

router.get("/yelp/search", async (req, res, next) => {
  try {
    const query = String(req.query.query ?? "").trim();
    const lat = parseNumber(req.query.lat);
    const lng = parseNumber(req.query.lng);
    const location = String(
      req.query.location ??
      (lat !== undefined && lng !== undefined ? `${lat},${lng}` : "Toronto, ON"),
    ).trim();

    if (!query) {
      res.status(400).json({ message: "query is required" });
      return;
    }

    res.json(await searchYelpRecommendations({ query, location }));
  } catch (error) {
    next(error);
  }
});

export default router;
