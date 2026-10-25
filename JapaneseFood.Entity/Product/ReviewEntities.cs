using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Product
{
    [Table("Reviews")]
    public class ReviewEntities : BaseEntities
    {
        public long ProductId { get; set; }
        public long UserId { get; set; }
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public bool IsApproved { get; set; }
    }
}
