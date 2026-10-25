using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Store
{
    // FAQ / policy entries shown on the site
    [Table("StorePolicies")]
    public class StorePolicyEntities : BaseEntities
    {
        // Stable key, e.g. "shipping", "returns", "opening-hours"
        public required string Topic { get; set; }
        public required string Title { get; set; }
        public required string Content { get; set; }
        public int SortOrder { get; set; }
        public ICollection<StorePolicyTranslationEntities> Translations { get; set; }
            = new List<StorePolicyTranslationEntities>();
    }
}
