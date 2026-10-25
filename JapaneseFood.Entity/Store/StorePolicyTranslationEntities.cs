using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Store
{
    [Table("StorePolicyTranslations")]
    public class StorePolicyTranslationEntities
    {
        public long Id { get; set; }
        public long StorePolicyId { get; set; }
        public required string LanguageCode { get; set; }
        public required string Title { get; set; }
        public required string Content { get; set; }
    }
}
