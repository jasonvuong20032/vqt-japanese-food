using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace JapaneseFood.Common.Enums
{
    public static class EnumCommons
    {
        // Numeric values 0-2 are stored in existing orders - never renumber them.
        public enum OrderStatus
        {
            [Description("Pending")]
            Pending = 0,
            [Description("Confirmed")]
            Confirmed = 1,
            [Description("Cancelled")]
            Cancelled = 2,
            [Description("Preparing")]
            Preparing = 3,
            [Description("Shipping")]
            Shipping = 4,
            [Description("Delivered")]
            Delivered = 5,
            [Description("Refunded")]
            Refunded = 6
        }

        public enum PaymentMethod
        {
            [Description("Cash on delivery")]
            Cod = 0,
            [Description("VNPay")]
            VnPay = 1,
            [Description("MoMo")]
            MoMo = 2
        }

        public enum PaymentStatus
        {
            [Description("Unpaid")]
            Unpaid = 0,
            [Description("Paid")]
            Paid = 1,
            [Description("Failed")]
            Failed = 2,
            [Description("Refunded")]
            Refunded = 3
        }

        public enum EGender
        {
            Male = 1,
            FeMale = 2,
            None = 3
        }

        public enum ERoleType
        {
            [Description("Customer")]
            Customer = 1,
            [Description("Admin")]
            Admin = 2,
            [Description("Staff")]
            Staff = 3
        }
    }
}
