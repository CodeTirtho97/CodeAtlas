from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str

    # Vector Database
    QDRANT_URL: str
    QDRANT_API_KEY: Optional[str] = None

    # APIs
    GOOGLE_API_KEY: str
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_DAYS: int = 7

    # Application
    FRONTEND_URL: str
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True

    def validate_required_fields(self):
        """Validate all required fields are set."""
        required = [
            "DATABASE_URL",
            "QDRANT_URL",
            "GOOGLE_API_KEY",
            "GITHUB_CLIENT_ID",
            "GITHUB_CLIENT_SECRET",
            "JWT_SECRET",
            "FRONTEND_URL",
        ]

        for field in required:
            value = getattr(self, field, None)
            if not value or value.startswith("your_"):
                raise ValueError(f"Missing or invalid required setting: {field}")


settings = Settings()
settings.validate_required_fields()
