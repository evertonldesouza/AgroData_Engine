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


app.UseCors("Frontend");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}


app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

var port = Environment.GetEnvironmentVariable("PORT") ?? "5072";
app.Run($"http://0.0.0.0:{port}");