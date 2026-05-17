import requests
import random
from datetime import datetime
import logging
import os
import time

# Configuração básica do logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class CommodityCollector:
    def __init__(self):
        # Usar variável de ambiente para a URL da API, ou um valor padrão para desenvolvimento
        self.api_url = os.getenv("COMMODITY_API_URL", "https://api.exemplo.com/v1/commodities")
        logging.info(f"Coletor inicializado com API URL: {self.api_url}")

    def fetch_mock_data(self, symbol):
        """
        Coleta dados mockados para uma commodity.
        Simula uma falha de rede ocasional para demonstrar tratamento de erro.
        """
        logging.info(f"Tentando coletar dados mockados para o símbolo: {symbol}")
        try:
            # Simular uma falha de rede ocasional
            if random.random() < 0.1: # 10% de chance de falha
                raise requests.exceptions.RequestException("Simulated network error")

            base_price = 135.0 if symbol == "SOJA" else 58.0
            variation = random.uniform(-1.5, 1.5)
            

            data = {
                "symbol": symbol,
                "price": round(base_price + variation, 2),
                "timestamp": datetime.utcnow().isoformat(), # Usar ISO format para serialização
                "source": "Simulated Market Data"
            }
            logging.info(f"Dados mockados coletados com sucesso para {symbol}: Preço {data['price']}")
            return data
        except requests.exceptions.RequestException as e:
            logging.error(f"Erro ao coletar dados mockados para {symbol}: {e}")
            return None
        except Exception as e:
            logging.error(f"Ocorreu um erro inesperado ao coletar dados para {symbol}: {e}")
            return None


if __name__ == "__main__":
    collector = CommodityCollector()
    print("\n--- Teste Isolado do Coletor ---")
    
    # Testando com SOJA
    data_soja = collector.fetch_mock_data("SOJA")
    if data_soja:
        print(f"Dados SOJA: {data_soja}")
    else:
        print("Falha ao coletar dados para SOJA.")
    
    time.sleep(1) # Pequena pausa para logs distintos
    
    # Testando com MILHO
    data_milho = collector.fetch_mock_data("MILHO")
    if data_milho:
        print(f"Dados MILHO: {data_milho}")
    else:
        print("Falha ao coletar dados para MILHO.")
    
    print("--- Fim do Teste ---")
