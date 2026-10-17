from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL, AUTH_TOKEN

# Database local setup
DATABASE_URL = "sqlite:///./database.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Database Turso setup (desativado: o engine local acima seria sobrescrito com
# a URL sqlite + auth_token, derrubando toda consulta com
# "TypeError: 'auth_token' is an invalid keyword argument for Connection()")
# engine = create_engine(
#     f"{DATABASE_URL}?secure=true",
#     connect_args={
#         "auth_token": AUTH_TOKEN,
#         "check_same_thread": False,
#     },
# )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Dependency
def get_db():
    """Dependency para obter sessão do banco de dados"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
