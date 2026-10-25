using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.User
{
    [Table("RefreshTokens")]
    public class RefreshTokenEntities
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        // SHA-256 of the token; the raw token only lives in the client cookie
        public required string TokenHash { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        public string? ReplacedByHash { get; set; }
    }
}
