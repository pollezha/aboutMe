using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Projector.Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "stats");

            migrationBuilder.CreateTable(
                name: "cta_clicks",
                schema: "stats",
                columns: table => new
                {
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    cta = table.Column<string>(type: "text", nullable: false),
                    source = table.Column<string>(type: "text", nullable: false),
                    n = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cta_clicks", x => new { x.day, x.cta, x.source });
                });

            migrationBuilder.CreateTable(
                name: "daily_visits",
                schema: "stats",
                columns: table => new
                {
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    source = table.Column<string>(type: "text", nullable: false),
                    device = table.Column<string>(type: "text", nullable: false),
                    visits = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_daily_visits", x => new { x.day, x.source, x.device });
                });

            migrationBuilder.CreateTable(
                name: "processed_events",
                schema: "stats",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_processed_events", x => x.event_id);
                });

            migrationBuilder.CreateTable(
                name: "stop_opens",
                schema: "stats",
                columns: table => new
                {
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    stop = table.Column<string>(type: "text", nullable: false),
                    n = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stop_opens", x => new { x.day, x.stop });
                });

            migrationBuilder.CreateTable(
                name: "web_vitals",
                schema: "stats",
                columns: table => new
                {
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    bucket = table.Column<int>(type: "integer", nullable: false),
                    n = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_web_vitals", x => new { x.day, x.name, x.bucket });
                });

            migrationBuilder.CreateIndex(
                name: "ix_processed_events_processed_at",
                schema: "stats",
                table: "processed_events",
                column: "processed_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cta_clicks",
                schema: "stats");

            migrationBuilder.DropTable(
                name: "daily_visits",
                schema: "stats");

            migrationBuilder.DropTable(
                name: "processed_events",
                schema: "stats");

            migrationBuilder.DropTable(
                name: "stop_opens",
                schema: "stats");

            migrationBuilder.DropTable(
                name: "web_vitals",
                schema: "stats");
        }
    }
}
