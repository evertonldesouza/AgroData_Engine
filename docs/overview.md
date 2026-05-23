# AgroData Engine - Project Context

## Overview
O AgroData Engine e uma plataforma de inteligencia de dados voltada ao setor agricola. O sistema automatiza a coleta de precos de commodities (Soja e Milho), processa indicadores de tendencia (medias moveis) e expoe esses dados atraves de uma API segura e um dashboard moderno.

## Objectives
- Prover visualizacao clara de tendencias para produtores rurais (Dashboard).
- Oferecer analise tecnica detalhada para analistas de mercado (Data Grid).

## Core Workflows
1. **Data Pipeline (Python):** Extracao de dados via API/Web Scraping -> Limpeza -> Carga no PostgreSQL (Supabase).
2. **Backend (.NET 10):** Camada de API protegida por JWT que consome o banco e fornece endpoints para o Frontend.
3. **Frontend (React 19):** Interface SPA com suporte a temas (Dark/Light) e consumo da API.
