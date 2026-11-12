from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ocr_service_secret: str = "dev-secret"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    max_concurrent_jobs: int = 2
    upload_dir: str = "/tmp/ocr_uploads"

    class Config:
        env_file = ".env"


settings = Settings()
