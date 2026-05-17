import os
import logging
from dotenv import load_dotenv
from database import SessionLocal
from models import CommodityPrice
from collector import CommodityCollector

# Configuração básica do logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv()

def run_pipeline():
    collector = CommodityCollector()
    db = SessionLocal()
    
    logging.info("🚀 Iniciando Pipeline de Dados para Supabase...")

    try:
        symbols = ["SOJA", "MILHO"]
        for symbol in symbols:
            raw_data = collector.fetch_mock_data(symbol)
            
            if raw_data:
                new_price = CommodityPrice(
                    Symbol=raw_data['symbol'],
                    Price=raw_data['price'],
                    Timestamp=raw_data['timestamp'],
                    Source=raw_data['source']
                )
                
                db.add(new_price)
                logging.info(f"💾 {symbol} preparado: R$ {raw_data['price']}")
            else:
                logging.warning(f"⚠️ Falha ao coletar dados para {symbol}. Pulando.")

        db.commit()
        logging.info("✅ Dados integrados com sucesso no Supabase!")

    except Exception as e:
        logging.error(f"❌ Erro crítico no pipeline: {e}")
        db.rollback() 
    finally:
        db.close()
        logging.info("Sessão do banco de dados fechada.")

if __name__ == "__main__":
    run_pipeline()