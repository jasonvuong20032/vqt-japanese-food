using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JapaneseFood.Entity.Migrations
{
    /// <inheritdoc />
    public partial class ChatReplay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ChatMessages_ConversationId",
                table: "ChatMessages");

            migrationBuilder.AddColumn<string>(
                name: "ContentJson",
                table: "ChatMessages",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "InContext",
                table: "ChatMessages",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "OrderCode",
                table: "ChatMessages",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Seq",
                table: "ChatMessages",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "CacheWriteTokens",
                table: "ChatConversations",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "ChatConversations",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ConversationId_Seq",
                table: "ChatMessages",
                columns: new[] { "ConversationId", "Seq" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ChatMessages_ConversationId_Seq",
                table: "ChatMessages");

            migrationBuilder.DropColumn(
                name: "ContentJson",
                table: "ChatMessages");

            migrationBuilder.DropColumn(
                name: "InContext",
                table: "ChatMessages");

            migrationBuilder.DropColumn(
                name: "OrderCode",
                table: "ChatMessages");

            migrationBuilder.DropColumn(
                name: "Seq",
                table: "ChatMessages");

            migrationBuilder.DropColumn(
                name: "CacheWriteTokens",
                table: "ChatConversations");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "ChatConversations");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ConversationId",
                table: "ChatMessages",
                column: "ConversationId");
        }
    }
}
