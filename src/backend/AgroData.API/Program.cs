using AgroData.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;
using AgroData.Domain.Interfaces;
using AgroData.Application.Interfaces;
using AgroData.Infrastructure.Repositories;
using AgroData.Application.Services;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));


var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "https://evertonldesouza.github.io";

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(frontendUrl)
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();


builder.Services.AddScoped<ICommodityRepository, CommodityRepository>();
builder.Services.AddScoped<ICommodityService, CommodityService>();

var app = builder.Build();


app.UseExceptionHandler("/error");

app.UseCors("Frontend");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}


app.MapControllers();

app.MapGet("/health", async (AppDbContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return canConnect
        ? Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow })
        : Results.StatusCode(503);
});

app.MapGet("/error", (HttpContext ctx) =>
{
    return Results.Problem(detail: "Ocorreu um erro interno.", statusCode: 500);
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "5072";
app.Run($"http://0.0.0.0:{port}");