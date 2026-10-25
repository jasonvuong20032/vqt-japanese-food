using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Product
{
    [Table("Wishlists")]
    public class WishlistEntities
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public long ProductId { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
