"""
Shared Python type definitions for the HabitCraft application
These types should match the OpenAPI specification and database schema
"""

from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field, validator
import re


# User models
class User(BaseModel):
    id: str
    email: EmailStr
    name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserRegistration(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user: User
    token: str


# Habit models
HabitFrequency = Literal['daily', 'weekly', 'custom']
HabitStatus = Literal['active', 'archived']


class HabitInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    frequency: HabitFrequency
    target_days: Optional[List[int]] = Field(default_factory=list)
    color: Optional[str] = Field(default='#3B82F6')
    icon: Optional[str] = Field(default='⭐')

    @validator('color')
    def validate_color(cls, v):
        if v and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError('Color must be a valid hex color code')
        return v

    @validator('target_days')
    def validate_target_days(cls, v):
        if v:
            for day in v:
                if not isinstance(day, int) or day < 0 or day > 6:
                    raise ValueError('target_days must contain integers between 0 and 6')
        return v


class Habit(HabitInput):
    id: str
    user_id: str
    status: HabitStatus = 'active'
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Completion models
class CompletionInput(BaseModel):
    date: date
    notes: Optional[str] = None


class Completion(BaseModel):
    id: str
    habit_id: str
    date: date
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Statistics models
class HabitStatistics(BaseModel):
    habit_id: str
    current_streak: int
    longest_streak: int
    total_completions: int
    completion_rate: float
    last_completed_date: Optional[date]


# API response models
class ApiError(BaseModel):
    error: str
    message: str
    status_code: int


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str


class HelloResponse(BaseModel):
    message: str


# Query parameters
class ListHabitsQuery(BaseModel):
    status: Optional[HabitStatus] = None


class ListCompletionsQuery(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
