using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace JapaneseFood.Entity.Order
{
    [Table("Orders")]
    public class OrderEntities : BaseEntities
    {
        public required string Code { get; set; }
        public long UserId { get; set; }
        public string? UserName { get; set; }
        public string? Address { get; set; }
        public string? FullName { get; set; }
        public string? Phone { get; set; }
        public int Quantity { get; set; }
        public decimal SubTotal { get; set; }
        public decimal Discount { get; set; }
        public decimal ShippingFee { get; set; }
        public decimal TotalAmount { get; set; }
        public int Status { get; set; }
        public string? Note { get; set; }
        public int PaymentMethod { get; set; }
        public int PaymentStatus { get; set; }
        public string? Province { get; set; }
        public string? District { get; set; }
        public string? Ward { get; set; }
        public string? CouponCode { get; set; }
        public DateTime? PaidAt { get; set; }
        public string? PaymentTransactionId { get; set; }
        public string? Language { get; set; }
        // True when stock was decremented at checkout (orders placed before v2 were not),
        // so cancelling only restocks orders that actually reserved stock
        public bool StockReserved { get; set; }
        public ICollection<OrderDetailEntities> Details { get; set; } = new List<OrderDetailEntities>();
    }
}
