# AgroData Engine - Project Context

## Overview
O AgroData Engine é uma plataforma de inteligência de dados voltada ao setor agrícola. O sistema automatiza a coleta de preços de commodities (Soja e Milho), processa indicadores de tendência (médias móveis) e expõe esses dados através de uma API segura e um dashboard moderno.

## Objectives
- Prover visualização clara de tendências para produtores rurais (Dashboard).
- Oferecer análise técnica detalhada para analistas de mercado (Data Grid).

## Core Workflows
1. **Data Pipeline (Python):** Extração de dados via API/Web Scraping -> Limpeza -> Carga no PostgreSQL (Supabase).
2. **Backend (.NET 8):** Camada de API protegida por JWT que consome o banco e fornece endpoints para o Frontend.
3. **Frontend (React):** Interface SPA com suporte a temas (Dark/Light) e consumo da API.