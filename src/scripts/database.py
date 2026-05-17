import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:

    logging.error("ERRO CRÍTICO: DATABASE_URL não definida nas variáveis de ambiente. Não é possível conectar ao banco de dados.")
    raise ValueError("DATABASE_URL não configurada. Defina a variável de ambiente.")
try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    logging.info("🚀 Database engine criado com sucesso!")
except SQLAlchemyError as e:
    logging.error(f"Erro ao criar o engine do banco de dados com a URL fornecida: {e}")
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():

    db = SessionLocal()
    try:
        logging.debug("Obtendo nova sessão de banco de dados.")
        yield db
    except SQLAlchemyError as e:
        logging.error(f"Ocorreu um erro na sessão do banco de dados: {e}")
        db.rollback()
        raise
    finally:
        logging.debug("Fechando sessão de banco de dados.")
        db.close()

if __name__ == "__main__":
    try:
        with engine.connect() as connection:
            logging.info("Conexão com o banco de dados estabelecida com sucesso!")
    except Exception as e:
        logging.error(f"Falha na conexão de teste com o banco de dados: {e}")

