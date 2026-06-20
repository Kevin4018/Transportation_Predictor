import { Router } from "express";

import { getConstructionImpact } from "../services/constructionService";

const router = Router();

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

router.get("/impact", (req, res) => {
  res.json(
    getConstructionImpact(
      parseNumber(req.query.lat, 43.6532),
      parseNumber(req.query.lng, -79.3832),
    ),
  );
});

export default router;
