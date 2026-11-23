import os
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Response
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import CommunityReport, Journey, UserPreferences
from .schemas import JourneyCreate, JourneyRead, Preferences, ReportCreate, ReportRead

PHOTON_URL = os.getenv("PHOTON_URL", "https://photon.komoot.io").rstrip("/")
OSRM_URL = os.getenv("OSRM_URL", "https://router.project-osrm.org").rstrip("/")


@asynccontextmanager
async def lifespan(_: FastAPI):
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Wayfinder API", version="1.0.0", lifespan=lifespan)


@app.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


@app.get("/api/places")
async def find_place(query: str = Query(min_length=2, max_length=200)) -> dict[str, object]:
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get(
            f"{PHOTON_URL}/api/",
            params={"q": query, "limit": 1, "lang": "en"},
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail="Place lookup service is unavailable.")
    features = response.json().get("features", [])
    if not features:
        raise HTTPException(status_code=404, detail=f"Couldn't find “{query}”. Check the spelling or add a city.")
    feature = features[0]
    properties = feature.get("properties", {})
    label_parts = [
        properties.get("name"),
        properties.get("street"),
        properties.get("city") or properties.get("locality"),
        properties.get("state"),
        properties.get("country"),
    ]
    return {
        "coordinates": feature["geometry"]["coordinates"],
        "label": ", ".join(dict.fromkeys(part for part in label_parts if part)) or query,
    }


@app.get("/api/routes")
async def find_routes(
    origin: str = Query(pattern=r"^-?\d+(\.\d+)?,-?\d+(\.\d+)?$"),
    destination: str = Query(pattern=r"^-?\d+(\.\d+)?,-?\d+(\.\d+)?$"),
) -> dict[str, object]:
    coordinates = f"{origin};{destination}"
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"{OSRM_URL}/route/v1/driving/{coordinates}",
            params={"alternatives": "3", "overview": "full", "geometries": "geojson", "steps": "true"},
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail="Road routing service is unavailable.")
    result = response.json()
    if result.get("code") != "Ok" or not result.get("routes"):
        raise HTTPException(status_code=404, detail="No drivable route was found between those places.")
    return result


@app.get("/api/reports", response_model=list[ReportRead])
def list_reports(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[CommunityReport]:
    return list(db.scalars(select(CommunityReport).order_by(CommunityReport.created_at.desc()).limit(limit)))


@app.post("/api/reports", response_model=ReportRead, status_code=201)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)) -> CommunityReport:
    report = CommunityReport(
        type=payload.type.strip(),
        place=payload.place.strip(),
        notes=payload.notes.strip(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@app.get("/api/preferences/{client_id}", response_model=Preferences)
def get_preferences(client_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    record = db.get(UserPreferences, client_id)
    return record.preferences if record else {
        "stepFree": True,
        "fewTransfers": False,
        "covered": False,
        "clearWayfinding": False,
    }


@app.put("/api/preferences/{client_id}", response_model=Preferences)
def put_preferences(
    client_id: str,
    payload: Preferences,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    record = db.get(UserPreferences, client_id)
    preferences = payload.model_dump()
    if record:
        record.preferences = preferences
    else:
        db.add(UserPreferences(client_id=client_id, preferences=preferences))
    db.commit()
    return preferences


@app.get("/api/journeys", response_model=list[JourneyRead])
def list_journeys(
    client_id: str = Query(min_length=1, max_length=80),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    journeys = db.scalars(
        select(Journey).where(Journey.client_id == client_id).order_by(Journey.created_at.desc())
    )
    return [
        {
            "id": item.id,
            "from": item.origin,
            "to": item.destination,
            "route": item.route,
            "time": item.time,
            "distance": item.distance,
            "etaRange": item.eta_range,
            "steps": item.steps,
            "savedAt": item.created_at,
        }
        for item in journeys
    ]


@app.post("/api/journeys", response_model=JourneyRead, status_code=201)
def create_journey(payload: JourneyCreate, db: Session = Depends(get_db)) -> dict[str, object]:
    journey = Journey(
        client_id=payload.client_id,
        origin=payload.from_,
        destination=payload.to,
        route=payload.route,
        time=payload.time,
        distance=payload.distance,
        eta_range=payload.etaRange,
        steps=payload.steps,
    )
    db.add(journey)
    db.commit()
    db.refresh(journey)
    return {
        "id": journey.id,
        "from": journey.origin,
        "to": journey.destination,
        "route": journey.route,
        "time": journey.time,
        "distance": journey.distance,
        "etaRange": journey.eta_range,
        "steps": journey.steps,
        "savedAt": journey.created_at,
    }


@app.delete("/api/journeys/{journey_id}", status_code=204)
def delete_journey(
    journey_id: int,
    client_id: str = Query(min_length=1, max_length=80),
    db: Session = Depends(get_db),
) -> Response:
    journey = db.scalar(
        select(Journey).where(Journey.id == journey_id, Journey.client_id == client_id)
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Saved journey not found.")
    db.delete(journey)
    db.commit()
    return Response(status_code=204)
