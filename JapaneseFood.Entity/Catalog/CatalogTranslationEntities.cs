using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Article
{
    [Table("CatalogTranslations")]
    public class CatalogTranslationEntities
    {
        public long Id { get; set; }
        public long CatalogId { get; set; }
        public required string LanguageCode { get; set; }
        public required string Name { get; set; }
        public string? Description { get; set; }
    }
}
