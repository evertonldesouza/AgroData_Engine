using AgroData.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AgroData.Infrastructure.Context.Configurations;

/// <summary>Mapping for <see cref="Commodity"/>.</summary>
/// <remarks>
/// Mirrors the EF Core migrations that own the schema. Table and column names
/// are PascalCase because the Python engine writes to the same table.
/// </remarks>
public sealed class CommodityConfiguration : IEntityTypeConfiguration<Commodity>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Commodity> builder)
    {
        builder.ToTable("Commodities");
        builder.HasKey(commodity => commodity.Id);

        builder.Property(commodity => commodity.Symbol).IsRequired();
        builder.Property(commodity => commodity.Price).IsRequired();
        builder.Property(commodity => commodity.Timestamp).IsRequired();
        builder.Property(commodity => commodity.Source).IsRequired();

        builder.HasIndex(commodity => commodity.Symbol);

        // Serves "latest N quotes of one symbol" without sorting the whole table.
        builder
            .HasIndex(commodity => new { commodity.Symbol, commodity.Timestamp })
            .HasDatabaseName("IX_Commodities_Symbol_Timestamp");
    }
}
