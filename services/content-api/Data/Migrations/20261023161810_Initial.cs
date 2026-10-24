using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContentApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "content");

            migrationBuilder.CreateTable(
                name: "bundles",
                schema: "content",
                columns: table => new
                {
                    lang = table.Column<string>(type: "text", nullable: false),
                    content_version = table.Column<string>(type: "text", nullable: false),
                    version_hash = table.Column<string>(type: "text", nullable: false),
                    json = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_bundles", x => x.lang);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bundles",
                schema: "content");
        }
    }
}
