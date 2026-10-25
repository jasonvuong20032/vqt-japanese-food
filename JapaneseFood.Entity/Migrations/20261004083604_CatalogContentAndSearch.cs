using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JapaneseFood.Entity.Migrations
{
    /// <inheritdoc />
    public partial class CatalogContentAndSearch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SearchName",
                table: "Products",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SearchText",
                table: "Products",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "CategoryTranslations",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Categorys",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Categorys",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "CatalogTranslations",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverImageUrl",
                table: "Catalogs",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Catalogs",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Catalogs",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Catalogs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Catalogs_Slug",
                table: "Catalogs",
                column: "Slug",
                unique: true,
                filter: "[Slug] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Catalogs_Slug",
                table: "Catalogs");

            migrationBuilder.DropColumn(
                name: "SearchName",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SearchText",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "CategoryTranslations");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Categorys");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Categorys");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "CatalogTranslations");

            migrationBuilder.DropColumn(
                name: "CoverImageUrl",
                table: "Catalogs");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Catalogs");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Catalogs");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Catalogs");
        }
    }
}
