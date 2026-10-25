using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.Order
{
    [Table("OrderStatusHistory")]
    public class OrderStatusHistoryEntities
    {
        public long Id { get; set; }
        public long OrderId { get; set; }
        public int FromStatus { get; set; }
        public int ToStatus { get; set; }
        public string? Note { get; set; }
        public string? ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }
}
