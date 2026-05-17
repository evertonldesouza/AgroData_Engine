# Technical Architecture Document

## Tech Stack
- **Database:** PostgreSQL (Hospedado no Supabase).
- **Data Engineering:** Python 3.x + SQLAlchemy (Pipeline Independente).
- **Backend:** .NET 8 (C#) com Clean Architecture.
- **Auth:** JWT (JSON Web Token) com RBAC (Role-Based Access Control).
- **ORM:** Entity Framework Core (EF Core).
- **Frontend:** React (Vite) + Tailwind CSS v4.
- **Infras:** Docker (Local) & Render (Cloud Deployment).

## Architecture Layers (C#)
1. **Domain:** Entities, Interfaces, Domain Exceptions.
2. **Application:** DTOs, Mappers, Use Cases (Services).
3. **Infrastructure:** Data Context, Repositories, External Services.
4. **API:** Controllers, Middlewares, Configurations.

## Visual Identity
- **Theme:** Agro Tech (Graphite & Forest Green).
- **Features:** Toggle Dark/Light Mode.