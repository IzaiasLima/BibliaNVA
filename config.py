import os
from dotenv import load_dotenv

load_dotenv()

CORS_ORIGINS = os.getenv("CORS_ORIGINS")

DATABASE_URL = os.getenv("DATABASE_URL")
AUTH_TOKEN = os.getenv("DB_AUTH_TOKEN")
