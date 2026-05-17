import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError

# Configuração básica do logger (se já não estiver configurada no script principal)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Pegar a URL do banco de dados da variável de ambiente por segurança
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # SEVERO: A DATABASE_URL não foi definida nas variáveis de ambiente.
    # O script não poderá se conectar ao banco de dados.
    # Em um ambiente de produção, isso deve ser um erro que impede o início do serviço.
    logging.error("ERRO CRÍTICO: DATABASE_URL não definida nas variáveis de ambiente. Não é possível conectar ao banco de dados.")
    raise ValueError("DATABASE_URL não configurada. Defina a variável de ambiente.")
try:
    # pool_pre_ping=True ajuda a detectar conexões caídas e restabelecê-las
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    logging.info("🚀 Database engine criado com sucesso!")
except SQLAlchemyError as e:
    logging.error(f"Erro ao criar o engine do banco de dados com a URL fornecida: {e}")
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    Função geradora para obter uma sessão de banco de dados.
    Lida com o fechamento da sessão e loga erros, se ocorrerem.
    """
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
    # Teste simples de conexão
    try:
        with engine.connect() as connection:
            logging.info("Conexão com o banco de dados estabelecida com sucesso!")
    except Exception as e:
        logging.error(f"Falha na conexão de teste com o banco de dados: {e}")

