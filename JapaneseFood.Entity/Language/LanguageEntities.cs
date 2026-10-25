using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace JapaneseFood.Entity.Language
{
    public class LanguageEntities
    {
        public int Id { get; set; }
        public string? National { get; set; }

        public string? Name { get; set; }
        // ISO 639-1 code used by the API and frontend: vi, en, ja, ko, fr
        public string Code { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public int SortOrder { get; set; }
    }
}
