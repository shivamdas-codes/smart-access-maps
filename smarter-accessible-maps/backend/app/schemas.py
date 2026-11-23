from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReportCreate(BaseModel):
    type: str = Field(min_length=1, max_length=120)
    place: str = Field(min_length=1, max_length=300)
    notes: str = Field(default="", max_length=3000)


class ReportRead(ReportCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    verification: str
    created_at: datetime


class Preferences(BaseModel):
    stepFree: bool
    fewTransfers: bool
    covered: bool
    clearWayfinding: bool


class JourneyCreate(BaseModel):
    client_id: str = Field(min_length=1, max_length=80)
    from_: str = Field(alias="from", min_length=1, max_length=300)
    to: str = Field(min_length=1, max_length=300)
    route: str = Field(min_length=1, max_length=120)
    time: str = Field(min_length=1, max_length=80)
    distance: str = Field(min_length=1, max_length=80)
    etaRange: str = Field(min_length=1, max_length=80)
    steps: list[str] = Field(max_length=50)


class JourneyRead(BaseModel):
    id: int
    from_: str = Field(alias="from")
    to: str
    route: str
    time: str
    distance: str
    etaRange: str
    steps: list[str]
    offlineSaved: bool = True
    savedAt: datetime

    model_config = ConfigDict(populate_by_name=True)
