# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy only the manifests first: the restore layer is reused until a package
# or project file changes.
COPY src/backend/Directory.Build.props src/backend/Directory.Packages.props ./
COPY src/backend/AgroData.API/AgroData.API.csproj AgroData.API/
COPY src/backend/AgroData.Application/AgroData.Application.csproj AgroData.Application/
COPY src/backend/AgroData.Domain/AgroData.Domain.csproj AgroData.Domain/
COPY src/backend/AgroData.Infrastructure/AgroData.Infrastructure.csproj AgroData.Infrastructure/
RUN dotnet restore AgroData.API/AgroData.API.csproj

COPY src/backend/ ./
RUN dotnet publish AgroData.API/AgroData.API.csproj \
        --configuration Release \
        --output /app/publish \
        /p:UseAppHost=false

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl powers the container health check; nothing else is installed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_NOLOGO=true

COPY --from=build /app/publish ./

# .NET 8+ Linux images ship a non-root user ("app", uid 1654, exposed as APP_UID).
USER $APP_UID

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl --fail --silent --show-error http://localhost:8080/health/live || exit 1

ENTRYPOINT ["dotnet", "AgroData.API.dll"]
