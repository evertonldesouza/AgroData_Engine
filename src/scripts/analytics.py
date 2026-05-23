import os
import logging
import pandas as pd
from dotenv import load_dotenv
from database import SessionLocal
from models import CommodityPrice

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
load_dotenv()


def calculate_trends() -> None:
    db = SessionLocal()
    logging.info("Analisando tendencias...")

    try:
        query = db.query(CommodityPrice).all()

        if not query:
            logging.warning("Sem dados para analise.")
            return

        df = pd.DataFrame([
            {'symbol': p.symbol, 'price': p.price, 'timestamp': p.timestamp}
            for p in query
        ])

        if df.empty:
            logging.warning("DataFrame vazio apos extracao.")
            return

        for symbol in df['symbol'].unique():
            symbol_df = df[df['symbol'] == symbol].sort_values(by='timestamp')
            if len(symbol_df) < 3:
                logging.warning(f"Dados insuficientes para {symbol} (min 3). Pulando.")
                continue

            symbol_df['moving_avg'] = symbol_df['price'].rolling(window=7).mean()
            latest = symbol_df.iloc[-1]
            ma_value = latest['moving_avg']

            if pd.isna(ma_value):
                logging.info(f"\n--- {symbol} ---")
                logging.info(f"Atual: R$ {latest['price']:.2f} | Media: insuficiente")
                continue

            logging.info(f"\n--- {symbol} ---")
            logging.info(f"Atual: R$ {latest['price']:.2f} | Media: R$ {ma_value:.2f}")

            if latest['price'] > ma_value:
                logging.info("Tendencia: ALTA")
            else:
                logging.info("Tendencia: BAIXA")

    except Exception as e:
        logging.error(f"Erro ao calcular tendencias: {e}")
    finally:
        db.close()
        logging.info("Sessao do banco fechada apos analise.")


if __name__ == "__main__":
    calculate_trends()
