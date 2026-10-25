using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace JapaneseFood.Entity.Article
{
    [Table("Catalogs")]
    public class CatalogEntities : BaseEntities
    {
        public required string Name { get; set; }
        public string? Slug { get; set; }
        public string? Description { get; set; }
        /// <summary>Optional wide banner photo; falls back to the best seller's photo.</summary>
        public string? CoverImageUrl { get; set; }
        public int SortOrder { get; set; }
    }
}
