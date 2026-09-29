from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from api.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass

def migrate_legacy_schema(engine):
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if not inspector.has_table("competitions"):
        return

    with engine.begin() as connection:
        columns = {column["name"] for column in inspector.get_columns("competitions")}
        if "required_predictions" not in columns:
            if "classification_schema" in columns:
                connection.execute(text(
                    "ALTER TABLE competitions RENAME COLUMN classification_schema TO required_predictions"
                ))
            else:
                connection.execute(text(
                    "ALTER TABLE competitions ADD COLUMN required_predictions JSON NOT NULL DEFAULT '[]'"
                ))

        if "evaluation_days" not in columns:
            connection.execute(text(
                "ALTER TABLE competitions ADD COLUMN evaluation_days VARCHAR(512) DEFAULT ''"
            ))
        if "evaluation_datasets" not in columns:
            connection.execute(text(
                "ALTER TABLE competitions ADD COLUMN evaluation_datasets JSON DEFAULT '{}'"
            ))

    if inspector.has_table("submissions"):
        sub_columns = {column["name"] for column in inspector.get_columns("submissions")}
        if "code_path" not in sub_columns:
            with engine.begin() as connection:
                connection.execute(text(
                    "ALTER TABLE submissions ADD COLUMN code_path VARCHAR(512) DEFAULT NULL"
                ))
