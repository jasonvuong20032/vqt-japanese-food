using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Category
{
    [Table("CategoryTranslations")]
    public class CategoryTranslationEntities
    {
        public long Id { get; set; }
        public long CategoryId { get; set; }
        public required string LanguageCode { get; set; }
        public required string Name { get; set; }
        public string? Description { get; set; }
    }
}
