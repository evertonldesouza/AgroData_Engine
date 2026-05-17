# AgroData Engine 🌿🚜

> Plataforma fullstack de monitoramento de commodities em tempo real.

<img src="./docs/Capture001.png" alt="Dashboard AgroData Engine em produção" />

🔗 **Live demo:** https://evertonldesouza.github.io/AgroData_Engine/

---

## ✨ Features

- Dashboard em tempo real com polling automático a cada 15s
- Indicadores de variação (% e absoluta) com cores semânticas (verde/vermelho)
- Sparkline custom em SVG puro — sem biblioteca pesada
- Indicador de "última atualização" relativo, atualizando a cada segundo
- Pipeline de dados em Python alimentando PostgreSQL/Supabase
- API REST .NET 10 com Clean Architecture (4 camadas)
- Frontend React 19 + Tailwind CSS v4
- Deploy contínuo via GitHub Actions

---

## 🏛️ Arquitetura

O sistema é composto por **três módulos independentes** que conversam via banco de dados e API REST:

```text
+----------------------+     +----------------------+     +----------------------+
|     Data Engine      |     |        API           |     |      Frontend        |
|     (Python)         |     |     (.NET 10)        |     |   (React + Vite)     |
|                      |     |                      |     |                      |
|  Coleta + ETL        |---->|  Clean Architecture  |<----|  Dashboard live      |
|  Schedule via        |     |  REST endpoints      |     |  Polling 15s         |
|  GitHub Actions      |     |                      |     |                      |
+----------+-----------+     +----------+-----------+     +----------------------+
           |                            ^
           v                            |
+----------+----------------------------+----------+
|         PostgreSQL (Supabase)                    |
|         Tabela: commodity_prices                 |
+--------------------------------------------------+
```

### Camadas (Backend .NET)

Segue os princípios de **Clean Architecture** — regras de negócio independentes de framework ou banco:

- **AgroData.Domain:** Entidades e interfaces de repositório
- **AgroData.Application:** DTOs, Mappers e serviços (use cases)
- **AgroData.Infrastructure:** Implementação do EF Core e repositórios concretos
- **AgroData.API:** Controllers REST, middlewares e injeção de dependência

### Pipeline de Dados (Python)

`src/scripts/` contém o motor de ingestão. Fluxo:

1. **Coleta** preços de commodities (Soja, Milho) de fonte externa
2. **Transformação** com pandas (limpeza, normalização)
3. **Persistência** no PostgreSQL via SQLAlchemy
4. **Agendamento** via GitHub Actions (cron) — executa em janela definida

### Frontend (React)

`src/frontend/src/App.jsx` orquestra a aplicação. Componentes principais:

- **`TickerCard`** — card de commodity com preço, variação dinâmica e sparkline
- **`Sparkline`** — mini-gráfico SVG puro, sem dependências externas
- **`RelativeTime`** — timestamp auto-atualizando via `date-fns`
- **Header compacto** — status do stream (LIVE/DEGRADED) inline
- **Market Performance chart** — gráfico principal via Recharts

---

## 🛠️ Stack

### Backend
- C# / .NET 10
- Entity Framework Core
- PostgreSQL (Supabase)
- Swagger / OpenAPI

### Data Engine
- Python 3.11+
- SQLAlchemy
- pandas

### Frontend
- React 19 + Vite
- Tailwind CSS v4 (configuração via `@theme` em CSS)
- Recharts (gráfico principal)
- SVG nativo (sparklines)
- date-fns (locale ptBR)
- lucide-react (ícones)

### DevOps
- Docker / docker-compose (PostgreSQL local)
- GitHub Actions (CI/CD + pipeline de dados)
- Render (API backend)
- GitHub Pages (frontend público)

---

## 🚀 Quick Start

### Pré-requisitos
- .NET 10 SDK
- Node.js 20+
- Docker Desktop
- Python 3.11+

### 1. Clonar e configurar variáveis

```bash
git clone https://github.com/evertonldesouza/AgroData_Engine.git
cd AgroData_Engine
```

Crie um arquivo `.env` na raiz com as variáveis de conexão (ou exporte no shell). As principais usadas pelo projeto:

```env
DATABASE_URL_PYTHON=postgresql://usuario:senha@host:5432/agrodata
ConnectionStrings__DefaultConnection=Host=host;Port=5432;Database=agrodata;Username=usuario;Password=senha
```

### 2. Subir o banco

```bash
docker-compose up -d
```

### 3. Backend (API .NET)

```bash
cd src/backend/AgroData.API
dotnet restore
dotnet run
```

A API sobe por padrão em `https://localhost:5001` com Swagger disponível em `/swagger`.

### 4. Frontend

```bash
cd src/frontend
npm install
npm run dev
```

Acesse `http://localhost:5173/AgroData_Engine/`.

### 5. Data Engine (opcional — popular dados)

```bash
cd src/scripts
python -m venv venv
.\venv\Scripts\activate    # Windows
# source venv/bin/activate # Linux/Mac
pip install -r requirements.txt
python main_pipeline.py
```

---

## 📚 Documentação adicional

- [Arquitetura técnica](./docs/arquitetura.md) — stack e camadas Clean Architecture em detalhe
- [Overview do projeto](./docs/overview.md) — objetivos, audiências-alvo e workflows

---

## 🤝 Convenções de commit

O projeto segue [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(escopo):    nova funcionalidade
fix(escopo):     correção de bug
chore(escopo):   manutenção / configuração
docs(escopo):    documentação
refactor:        refatoração sem mudar comportamento
```

Mudanças entram via Pull Request com descrição estruturada (Why / What / How).

---

## 📝 Licença

MIT

---

*Desenvolvido como parte de uma jornada de evolução profissional de tecnologias legadas para uma stack moderna.*