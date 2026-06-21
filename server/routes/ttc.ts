import { Router } from "express";

import {
  getBusReport,
  getNavigationRoute,
  getNearbyStops,
  getPrediction,
  getStopMeta,
  searchDestinations,
  searchStops,
} from "../services/ttcService";
import {
  classifyTransitAssistantIntent,
  verifyTransitAssistantAnswer,
  type TransitAssistantIntent,
  type TransitAssistantIntentContext,
} from "../services/geminiIntentService";
import type { NavigationMode } from "../services/ttcService";

const router = Router();

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseNavigationMode = (value: unknown): NavigationMode => {
  const mode = String(value ?? "bus");
  return mode === "car" || mode === "walk" || mode === "bike" ? mode : "bus";
};

router.get("/stops/search", (req, res) => {
  res.json(searchStops(String(req.query.q ?? "")));
});

router.get("/destinations/search", async (req, res, next) => {
  try {
    res.json(await searchDestinations(String(req.query.q ?? "")));
  } catch (error) {
    next(error);
  }
});

router.get("/stops/nearby", (req, res) => {
  const lat = parseNumber(req.query.lat);
  const lng = parseNumber(req.query.lng);

  res.json(getNearbyStops(lat, lng));
});

router.get("/stops/:stopId", (req, res, next) => {
  try {
    res.json(getStopMeta(req.params.stopId));
  } catch (error) {
    next(error);
  }
});

router.get("/prediction", (req, res, next) => {
  try {
    res.json(
      getPrediction(
        String(req.query.stopId ?? ""),
        parseNumber(req.query.routeId),
        String(req.query.direction ?? ""),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/bus-report", (req, res, next) => {
  try {
    res.json(
      getBusReport(
        String(req.query.stopId ?? ""),
        parseNumber(req.query.routeId),
        String(req.query.direction ?? ""),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/navigation", async (req, res, next) => {
  try {
    const originLat = Number(req.query.originLat);
    const originLng = Number(req.query.originLng);
    const originCoordinates =
      Number.isFinite(originLat) && Number.isFinite(originLng)
        ? { lat: originLat, lng: originLng }
        : undefined;

    res.json(
      await getNavigationRoute(
        String(req.query.origin ?? ""),
        String(req.query.destination ?? ""),
        originCoordinates,
        parseNavigationMode(req.query.mode),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/assistant/intent", async (req, res, next) => {
  try {
    const input = String(req.body?.input ?? "").trim();
    const context = (req.body?.context ?? {}) as TransitAssistantIntentContext;

    if (!input) {
      res.status(400).json({ message: "input is required" });
      return;
    }

    res.json(await classifyTransitAssistantIntent(input, context));
  } catch (error) {
    next(error);
  }
});

router.post("/assistant/verify-answer", async (req, res, next) => {
  try {
    const input = String(req.body?.input ?? "").trim();
    const draftAnswer = String(req.body?.draftAnswer ?? "").trim();
    const matchedIntent = String(req.body?.matchedIntent ?? "help") as TransitAssistantIntent;
    const confidence = parseNumber(req.body?.confidence, 60);
    const context = (req.body?.context ?? {}) as TransitAssistantIntentContext;

    if (!input || !draftAnswer) {
      res.status(400).json({ message: "input and draftAnswer are required" });
      return;
    }

    res.json(
      await verifyTransitAssistantAnswer({
        input,
        draftAnswer,
        matchedIntent,
        confidence,
        context,
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
