using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseFood.Entity.User
{
    [Table("UserAddresses")]
    public class UserAddressEntities
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public required string FullName { get; set; }
        public required string Phone { get; set; }
        public string? Province { get; set; }
        public string? District { get; set; }
        public string? Ward { get; set; }
        public required string Street { get; set; }
        public bool IsDefault { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
