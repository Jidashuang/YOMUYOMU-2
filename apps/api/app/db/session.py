from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if _is_sqlite else {}

if _is_sqlite:
    # SQLite (tests) uses SingletonThreadPool/StaticPool, which reject QueuePool sizing args.
    engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)
else:
    # Recycle connections well before typical Postgres/idle cutoffs so long-running
    # annotation jobs don't trip over "server closed the connection unexpectedly".
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=10,
        max_overflow=20,
        pool_timeout=30,
        connect_args=connect_args,
    )
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
