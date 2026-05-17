import os
from dotenv import load_dotenv
import pandas as pd
from database import SessionLocal
from models import CommodityPrice
import logging

# Configuração básica do logger (se já não estiver configurada no script principal)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv() # Carrega as variáveis do arquivo .env - Adicionado

def calculate_trends():
    db = SessionLocal()
    logging.info("📊 Analisando tendências no Supabase...")

    try:
        query = db.query(CommodityPrice).all()
        
        df = pd.DataFrame([
            {'symbol': p.Symbol, 'price': p.Price, 'timestamp': p.Timestamp} 
            for p in query
        ])

        if df.empty:
            logging.warning("⚠️ Sem dados no Supabase para análise.")
            return

        for symbol in df['symbol'].unique():
            symbol_df = df[df['symbol'] == symbol].sort_values(by='timestamp')
            symbol_df['moving_avg'] = symbol_df['price'].rolling(window=3).mean()
            
            latest = symbol_df.iloc[-1]
            
            logging.info(f"\n--- {symbol} ---")
            logging.info(f"Atual: R$ {latest['price']:.2f} | Média: R$ {latest['moving_avg']:.2f}")
            
            if latest['price'] > latest['moving_avg']:
                logging.info("📈 Tendência: ALTA")
            else:
                logging.info("📉 Tendência: BAIXA")

    except Exception as e:
        logging.error(f"❌ Erro ao calcular tendências: {e}")
    finally:
        db.close()
        logging.info("Sessão do banco de dados fechada após análise.")

if __name__ == "__main__":
    calculate_trends()