using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Product
{
    [Table("ProductTranslations")]
    public class ProductTranslationEntities
    {
        public long Id { get; set; }
        public long ProductId { get; set; }
        public required string LanguageCode { get; set; }
        public required string Name { get; set; }
        public string? ShortDescription { get; set; }
        public string? Description { get; set; }
        public ProductEntities Product { get; set; } = null!;
    }
}
