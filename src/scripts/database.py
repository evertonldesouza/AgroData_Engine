import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError
from typing import Generator

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logging.error("DATABASE_URL nao definida nas variaveis de ambiente.")
    raise ValueError("DATABASE_URL nao configurada.")

try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    logging.info("Database engine criado com sucesso!")
except SQLAlchemyError as e:
    logging.error(f"Erro ao criar engine do banco: {e}")
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logging.error(f"Erro na sessao do banco: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        with engine.connect() as connection:
            logging.info("Conexao com o banco estabelecida!")
    except Exception as e:
        logging.error(f"Falha na conexao de teste: {e}")
