using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgroData.Infrastructure.Migrations
{
    /// <summary>
    /// Adds the indexes used by the dashboard queries:
    /// <list type="bullet">
    ///   <item><c>IX_Commodities_Symbol</c> — distinct symbol lookup.</item>
    ///   <item><c>IX_Commodities_Symbol_Timestamp</c> — "latest N quotes of one symbol".</item>
    /// </list>
    /// </summary>
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Commodities_Symbol",
                table: "Commodities",
                column: "Symbol");

            migrationBuilder.CreateIndex(
                name: "IX_Commodities_Symbol_Timestamp",
                table: "Commodities",
                columns: new[] { "Symbol", "Timestamp" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Commodities_Symbol_Timestamp",
                table: "Commodities");

            migrationBuilder.DropIndex(
                name: "IX_Commodities_Symbol",
                table: "Commodities");
        }
    }
}
