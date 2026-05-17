from database import SessionLocal
from models import CommodityPrice
from collector import CommodityCollector
import os
from dotenv import load_dotenv

load_dotenv()

def run_pipeline():
    collector = CommodityCollector()
    db = SessionLocal()
    
    print("🚀 Iniciando Pipeline de Dados para Supabase...")

    try:
        for symbol in ["SOJA", "MILHO"]:
            raw_data = collector.fetch_mock_data(symbol)
            
            new_price = CommodityPrice(
                Symbol=raw_data['symbol'],
                Price=raw_data['price'],
                Timestamp=raw_data['timestamp'],
                Source=raw_data['source']
            )
            
            db.add(new_price)
            print(f"💾 {symbol} preparado: R$ {raw_data['price']}")

        db.commit()
        print("✅ Dados integrados com sucesso no Supabase!")

    except Exception as e:
        print(f"❌ Erro no pipeline: {e}")
        db.rollback() 
    finally:
        db.close()

if __name__ == "__main__":
    run_pipeline()