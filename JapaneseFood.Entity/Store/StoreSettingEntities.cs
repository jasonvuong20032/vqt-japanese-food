using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Store
{
    // Key/value store settings, e.g. "Shipping.Fee", "Shipping.FreeThreshold", "Store.Name"
    [Table("StoreSettings")]
    public class StoreSettingEntities
    {
        public int Id { get; set; }
        public required string Key { get; set; }
        public string? Value { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
