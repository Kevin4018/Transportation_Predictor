# Responsive TTC Transit App

This project is a TTC transit prototype with:

- Vite/React frontend
- Express API server
- local TTC GTFS SQLite database for stops and scheduled arrivals
- OpenTripPlanner 2.8 for real walking, driving, biking, and TTC routing
- live place search through a geocoder for arbitrary destinations

## Prerequisites

- Node.js 20+
- npm
- Java 21+ for OpenTripPlanner

Install dependencies once:

```bash
npm install
```

Create your local env file:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

## Data Files

The app expects local data under `data/`.

Current expected files:

```text
data/
  gtfs.sqlite
  source/
    Complete GTFS.zip
  otp/
    otp-shaded-2.8.1.jar
    ttc.gtfs.zip
    toronto.osm.pbf
  construction/
    Road-reconstruction-program.geojson
```

If `data/gtfs.sqlite` is missing but the GTFS zip is available, build it with:

```bash
npm run setup:data
```

Large database/data files are local runtime assets and may not be committed to Git.

## Environment

Important `.env` values:

```env
PORT=3001
GTFS_DB_PATH=./data/gtfs.sqlite
OTP_BASE_URL=http://localhost:8080
OTP_PLAN_DATETIME=match-weekday
OTP_GTFS_SERVICE_START_DATE=2026-06-21
```

`OTP_PLAN_DATETIME=match-weekday` maps the current clock time to the same weekday inside the GTFS feed calendar. This avoids failed transit searches when today's real date is outside the downloaded TTC feed's service dates.

Restart `npm run server` after changing `.env`.

## Start OpenTripPlanner

Open a terminal from the project root and run:

```bash
java -Xmx4G -jar ./data/otp/otp-shaded-2.8.1.jar --build --serve ./data/otp
```

On Windows PowerShell:

```powershell
java -Xmx4G -jar .\data\otp\otp-shaded-2.8.1.jar --build --serve .\data\otp
```

Keep this terminal running. OTP is ready when you see a log line like:

```text
Grizzly server running
```

The Express API calls OTP at:

```text
http://localhost:8080/otp/gtfs/v1
```

If OTP is not running, navigation routes return `Navigation unavailable.`

## Start The App

Use three terminals:

1. OpenTripPlanner:

```bash
java -Xmx4G -jar ./data/otp/otp-shaded-2.8.1.jar --build --serve ./data/otp
```

2. Express API:

```bash
npm run server
```

3. Vite frontend:

```bash
npm run dev
```

For local network testing:

```bash
npm run dev -- --host 0.0.0.0
```

Then open the Vite URL shown in the frontend terminal, usually:

```text
http://localhost:5173
```

## Common Issues

- Search or navigation changes do not show up: restart `npm run server`.
- OTP says no transit route: confirm the Java OTP terminal is still running on port `8080`.
- Transit only works on one date: keep `OTP_PLAN_DATETIME=match-weekday`.
- Browser location does not show: allow location permission for the local site in the browser.
- Arbitrary destination search needs network access because it uses an online geocoder.
