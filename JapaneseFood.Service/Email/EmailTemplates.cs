using System.Globalization;
using System.Net;
using System.Text;
using JapaneseFood.Service.Common;
using JapaneseFood.Service.Orders;
using JapaneseFood.Service.Settings;

namespace JapaneseFood.Service.Email
{
    public enum CodePurpose { Activation, PasswordReset }

    /// <summary>
    /// Customer emails in the customer's language (vi, en, ja, ko, fr; anything else falls back to Vietnamese),
    /// in the storefront's look: washi background, vermilion accent, serif headings, and a dark variant for
    /// mail apps that honour prefers-color-scheme. Every user-provided value is HTML-encoded.
    /// </summary>
    public static class EmailTemplates
    {
        public static EmailMessage OrderPlaced(string to, OrderView order, StoreInfo store, string lang)
        {
            var t = Texts.For(lang);
            var rows = new StringBuilder();
            foreach (var line in order.Lines)
                rows.Append(Row($"{Enc(line.ProductName)} <span class=\"jf-muted\" style=\"color:#6b6157\">× {line.Quantity}</span>", Money(line.LineTotal, t.Lang)));

            var totals = new StringBuilder()
                .Append(Row(t.Subtotal, Money(order.Subtotal, t.Lang), top: true))
                .Append(order.Discount > 0 ? Row(t.Discount + (order.CouponCode is null ? "" : $" ({Enc(order.CouponCode)})"), "−" + Money(order.Discount, t.Lang)) : "")
                .Append(Row(t.Shipping, order.ShippingFee == 0 ? t.Free : Money(order.ShippingFee, t.Lang)))
                .Append(Row($"<strong>{t.Total}</strong>", $"<strong style=\"font-size:18px\">{Money(order.Total, t.Lang)}</strong>", top: true));

            var body = $"""
                <h1 class="jf-text" style="{H1}">{Format(t.ThanksTitle, order.FullName)}</h1>
                <p class="jf-muted" style="{Muted}">{t.ThanksText}</p>
                {CodeBox(t.OrderCode, order.Code)}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:20px;font-size:15px">
                  {rows}{totals}
                </table>
                <p class="jf-muted" style="{Muted};margin-top:16px">{t.Payment}: {t.Cod}</p>
                <div class="jf-line" style="border-top:1px solid #e6ddd1;margin:20px 0"></div>
                <p class="jf-text" style="{Text}"><strong>{t.ShipTo}</strong><br>{Enc(order.FullName)} · {Enc(order.Phone)}<br>{Enc(order.Address)}</p>
                {(string.IsNullOrWhiteSpace(order.Note) ? "" : $"<p class=\"jf-muted\" style=\"{Muted}\">“{Enc(order.Note)}”</p>")}
                {TrackButton(store, order.Code, order.Phone, t.Track)}
                """;
            var subject = $"[{store.Name}] {Raw(t.PlacedSubject, order.Code)}";
            return new EmailMessage(to, subject, Layout(t, store, subject, Raw(t.ThanksTitle, order.FullName), body));
        }

        public static EmailMessage OrderStatusChanged(string to, string code, string? fullName, string? phone, int status, string? note,
            StoreInfo store, string lang)
        {
            var t = Texts.For(lang);
            var statusName = t.Statuses.GetValueOrDefault(status, t.Statuses[1]);
            var body = $"""
                <h1 class="jf-text" style="{H1}">{Format(t.Hello, fullName)}</h1>
                <p class="jf-text" style="{Text}">{Format(t.StatusLine, code)}</p>
                <p style="margin:16px 0"><span style="display:inline-block;background:#b83a1c;color:#ffffff;border-radius:999px;padding:8px 18px;font-weight:bold;font-size:16px">{Enc(statusName)}</span></p>
                {(t.StatusHints.TryGetValue(status, out var hint) ? $"<p class=\"jf-muted\" style=\"{Muted}\">{hint}</p>" : "")}
                {(string.IsNullOrWhiteSpace(note) ? "" : $"<p class=\"jf-text\" style=\"{Text}\"><strong>{t.StoreNote}:</strong> {Enc(note)}</p>")}
                {TrackButton(store, code, phone, t.Track)}
                """;
            var subject = $"[{store.Name}] {Raw(t.StatusSubject, code, statusName)}";
            return new EmailMessage(to, subject, Layout(t, store, subject, Raw(t.StatusSubject, code, statusName), body));
        }

        public static EmailMessage Code(string to, string? fullName, string code, CodePurpose purpose, TimeSpan lifetime, StoreInfo store, string lang)
        {
            var t = Texts.For(lang);
            var (subjectText, intro) = purpose == CodePurpose.PasswordReset ? (t.ResetSubject, t.ResetIntro) : (t.ActivationSubject, t.ActivationIntro);
            var body = $"""
                <h1 class="jf-text" style="{H1}">{Format(t.Hello, fullName)}</h1>
                <p class="jf-text" style="{Text}">{intro}</p>
                <p style="margin:20px 0;text-align:center"><span class="jf-code" style="display:inline-block;font-family:'Courier New',monospace;font-size:34px;letter-spacing:10px;font-weight:bold;color:#1c1917;background:#f3ede4;border-radius:12px;padding:14px 24px">{Enc(code)}</span></p>
                <p class="jf-muted" style="{Muted}">{Format(t.CodeExpiry, (int)lifetime.TotalMinutes)}</p>
                <p class="jf-muted" style="{Muted}">{t.CodeIgnore}</p>
                """;
            var subject = $"[{store.Name}] {subjectText}";
            return new EmailMessage(to, subject, Layout(t, store, subject, intro, body));
        }

        // ---------------------------------------------------------------- building blocks

        private const string H1 = "margin:0 0 8px;font-family:Georgia,'Times New Roman','Hiragino Mincho ProN','Yu Mincho','Nanum Myeongjo',serif;font-size:24px;line-height:1.3;color:#1c1917;font-weight:bold";
        private const string Text = "margin:0 0 12px;font-size:15px;line-height:1.6;color:#1c1917";
        private const string Muted = "margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b6157";

        private static string Layout(Texts t, StoreInfo store, string title, string preheader, string body) => $$"""
            <!doctype html>
            <html lang="{{t.Lang}}">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="color-scheme" content="light dark">
            <meta name="supported-color-schemes" content="light dark">
            <title>{{Enc(title)}}</title>
            <style>
              @media (prefers-color-scheme: dark) {
                .jf-bg { background:#121212 !important; }
                .jf-card { background:#1b1b1b !important; border-color:#2c2c2c !important; }
                .jf-text, .jf-text td { color:#f5f5f4 !important; }
                .jf-muted { color:#a8a29e !important; }
                .jf-line { border-color:#2c2c2c !important; }
                .jf-code { background:#2a2522 !important; color:#f5f5f4 !important; }
                .jf-brand { color:#f5f5f4 !important; }
              }
            </style>
            </head>
            <body class="jf-bg" style="margin:0;padding:0;background:#faf7f2;font-family:'Be Vietnam Pro','Segoe UI',Arial,'Hiragino Sans','Yu Gothic','Malgun Gothic',sans-serif">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0">{{Enc(preheader)}}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="jf-bg" style="background:#faf7f2">
              <tr><td align="center" style="padding:28px 12px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
                  <tr><td style="padding:0 4px 18px">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="width:40px;height:40px;border-radius:20px;background:#b83a1c;color:#ffffff;text-align:center;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:18px;font-weight:bold">和</td>
                      <td class="jf-brand" style="padding-left:10px;font-family:Georgia,serif;font-size:19px;font-weight:bold;color:#1c1917">{{Enc(store.Name)}}</td>
                    </tr></table>
                  </td></tr>
                  <tr><td class="jf-card jf-text" style="background:#ffffff;border:1px solid #e6ddd1;border-radius:18px;padding:28px 26px;color:#1c1917">
                    {{body}}
                  </td></tr>
                  <tr><td class="jf-muted" style="padding:18px 6px;font-size:12px;line-height:1.6;color:#6b6157;text-align:center">
                    {{Enc(store.Name)}} · {{Enc(store.Address)}}<br>
                    {{Enc(store.Phone)}} · {{Enc(store.Email)}} · {{Format(t.Hours, store.OpeningHours)}}<br>
                    {{t.Footer}}
                  </td></tr>
                </table>
              </td></tr>
            </table>
            </body>
            </html>
            """;

        private static string Row(string label, string value, bool top = false) =>
            $"<tr><td class=\"jf-text jf-line\" style=\"padding:{(top ? "12px" : "5px")} 0 5px;{(top ? "border-top:1px solid #e6ddd1;" : "")}color:#1c1917\">{label}</td>" +
            $"<td class=\"jf-text jf-line\" style=\"padding:{(top ? "12px" : "5px")} 0 5px;{(top ? "border-top:1px solid #e6ddd1;" : "")}text-align:right;white-space:nowrap;color:#1c1917\">{value}</td></tr>";

        private static string CodeBox(string label, string code) =>
            $"<p class=\"jf-muted\" style=\"{Muted};margin-top:18px\">{label}</p>" +
            $"<p style=\"margin:0\"><span class=\"jf-code\" style=\"display:inline-block;font-family:'Courier New',monospace;font-size:20px;font-weight:bold;letter-spacing:2px;color:#1c1917;background:#f3ede4;border-radius:10px;padding:8px 14px\">{Enc(code)}</span></p>";

        /// <summary>One-click status check on the public tracking page (it reads code and phone from the query).</summary>
        private static string TrackButton(StoreInfo store, string code, string? phone, string label)
        {
            if (!Uri.TryCreate(store.PublicUrl, UriKind.Absolute, out var site) || string.IsNullOrWhiteSpace(phone)) return "";
            var url = $"{site.ToString().TrimEnd('/')}/track?code={Uri.EscapeDataString(code)}&phone={Uri.EscapeDataString(phone)}";
            return $"<p style=\"margin:24px 0 4px\"><a href=\"{Enc(url)}\" style=\"display:inline-block;background:#b83a1c;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:999px;padding:12px 26px\">{label}</a></p>";
        }

        /// <summary>VND with the customer's number style, like the storefront (145.000 ₫ / ₫145,000 / 145 000 ₫).</summary>
        public static string Money(decimal amount, string lang)
        {
            var culture = CultureInfo.GetCultureInfo(lang switch { "en" => "en-US", "ja" => "ja-JP", "ko" => "ko-KR", "fr" => "fr-FR", _ => "vi-VN" });
            var number = Math.Round(amount, 0).ToString("N0", culture);
            return lang is "en" or "ja" or "ko" ? $"₫{number}" : $"{number} ₫";
        }

        private static string Format(string template, params object?[] values)
            => string.Format(CultureInfo.InvariantCulture, template, values.Select(v => v is string s ? Enc(s) : v ?? "").ToArray());

        /// <summary>Plain text (subjects, preheaders): no HTML encoding here, Layout encodes once.</summary>
        private static string Raw(string template, params object?[] values)
            => string.Format(CultureInfo.InvariantCulture, template, values.Select(v => v ?? "").ToArray());

        private static string Enc(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

        // ---------------------------------------------------------------- strings

        private sealed record Texts(
            string Lang,
            string PlacedSubject, string ThanksTitle, string ThanksText, string OrderCode,
            string Subtotal, string Discount, string Shipping, string Free, string Total, string Payment, string Cod, string ShipTo, string Track,
            string StatusSubject, string Hello, string StatusLine, string StoreNote,
            IReadOnlyDictionary<int, string> Statuses, IReadOnlyDictionary<int, string> StatusHints,
            string ActivationSubject, string ActivationIntro, string ResetSubject, string ResetIntro, string CodeExpiry, string CodeIgnore,
            string Hours, string Footer)
        {
            public static Texts For(string? lang) => All.TryGetValue(Languages.Normalize(lang), out var t) ? t : All["vi"];

            private static readonly Dictionary<string, Texts> All = new()
            {
                ["vi"] = new("vi",
                    "Xác nhận đơn hàng {0}", "Cảm ơn {0} đã đặt hàng!", "Cửa hàng đã nhận đơn và sẽ gọi xác nhận trong ít phút. Món được chuẩn bị ngay khi đơn được xác nhận.", "Mã đơn hàng",
                    "Tạm tính", "Giảm giá", "Phí giao hàng", "Miễn phí", "Tổng cộng", "Thanh toán", "Thanh toán khi nhận hàng (COD)", "Giao đến", "Theo dõi đơn hàng",
                    "Đơn {0}: {1}", "Xin chào {0},", "Đơn hàng <strong>{0}</strong> của bạn vừa được cập nhật:", "Lời nhắn từ cửa hàng",
                    new Dictionary<int, string> { [0] = "Chờ xác nhận", [1] = "Đã xác nhận", [2] = "Đã huỷ", [3] = "Đang chuẩn bị", [4] = "Đang giao", [5] = "Đã giao", [6] = "Đã hoàn tiền" },
                    new Dictionary<int, string> { [3] = "Bếp đang chuẩn bị món của bạn.", [4] = "Shipper đang trên đường tới, bạn để ý điện thoại nhé.", [5] = "Chúc bạn ngon miệng! Hãy để lại đánh giá món ăn nếu bạn hài lòng.", [2] = "Nếu bạn không yêu cầu huỷ, vui lòng gọi cho cửa hàng." },
                    "Mã kích hoạt tài khoản", "Đây là mã kích hoạt tài khoản của bạn:", "Mã đặt lại mật khẩu", "Đây là mã để đặt lại mật khẩu của bạn:",
                    "Mã có hiệu lực trong {0} phút.", "Nếu bạn không yêu cầu, hãy bỏ qua email này.",
                    "Mở cửa {0}", "Bạn nhận email này vì đã đặt hàng hoặc tạo tài khoản trên website của chúng tôi."),
                ["en"] = new("en",
                    "Order {0} confirmed", "Thank you, {0}!", "We've received your order and will call to confirm it shortly. The kitchen starts as soon as it's confirmed.", "Order number",
                    "Subtotal", "Discount", "Delivery", "Free", "Total", "Payment", "Cash on delivery (COD)", "Deliver to", "Track your order",
                    "Order {0}: {1}", "Hello {0},", "Your order <strong>{0}</strong> has been updated:", "Note from the store",
                    new Dictionary<int, string> { [0] = "Pending", [1] = "Confirmed", [2] = "Cancelled", [3] = "Preparing", [4] = "Out for delivery", [5] = "Delivered", [6] = "Refunded" },
                    new Dictionary<int, string> { [3] = "The kitchen is preparing your food.", [4] = "Your rider is on the way, keep your phone close.", [5] = "Enjoy your meal! If you liked it, please leave a review.", [2] = "If you didn't ask to cancel, please call the store." },
                    "Your activation code", "Here is the code to activate your account:", "Your password reset code", "Here is the code to reset your password:",
                    "The code is valid for {0} minutes.", "If you didn't ask for this, you can ignore this email.",
                    "Open {0}", "You're receiving this email because you ordered or created an account on our website."),
                ["ja"] = new("ja",
                    "ご注文 {0} を承りました", "{0} 様、ご注文ありがとうございます。", "ご注文を受け付けました。まもなく確認のお電話をいたします。確認後すぐに調理を始めます。", "注文番号",
                    "小計", "割引", "配送料", "無料", "合計", "お支払い", "代金引換（COD）", "お届け先", "注文状況を確認",
                    "ご注文 {0}：{1}", "{0} 様", "ご注文 <strong>{0}</strong> のステータスが更新されました：", "店舗からのメッセージ",
                    new Dictionary<int, string> { [0] = "確認待ち", [1] = "確認済み", [2] = "キャンセル", [3] = "調理中", [4] = "配達中", [5] = "お届け済み", [6] = "返金済み" },
                    new Dictionary<int, string> { [3] = "ただいま調理しております。", [4] = "配達員がお届けに向かっています。お電話に出られるようにお願いします。", [5] = "どうぞお召し上がりください。よろしければレビューをお寄せください。", [2] = "キャンセルにお心当たりがない場合は、店舗までお電話ください。" },
                    "アカウント有効化コード", "アカウントを有効にするためのコードです：", "パスワード再設定コード", "パスワードを再設定するためのコードです：",
                    "コードの有効期限は{0}分です。", "お心当たりがない場合は、このメールを破棄してください。",
                    "営業時間 {0}", "このメールは、当店ウェブサイトでのご注文またはアカウント登録に基づいてお送りしています。"),
                ["ko"] = new("ko",
                    "주문 {0} 접수 완료", "{0}님, 주문해 주셔서 감사합니다!", "주문을 접수했으며 곧 확인 전화를 드리겠습니다. 확인되는 대로 바로 조리를 시작합니다.", "주문 번호",
                    "소계", "할인", "배송비", "무료", "합계", "결제", "현장 결제(COD)", "배송지", "주문 조회",
                    "주문 {0}: {1}", "{0}님, 안녕하세요.", "주문 <strong>{0}</strong>의 상태가 업데이트되었습니다:", "매장 메시지",
                    new Dictionary<int, string> { [0] = "확인 대기", [1] = "주문 확인", [2] = "취소됨", [3] = "조리 중", [4] = "배달 중", [5] = "배달 완료", [6] = "환불 완료" },
                    new Dictionary<int, string> { [3] = "주방에서 음식을 준비하고 있습니다.", [4] = "배달 기사님이 가고 있습니다. 전화를 받을 수 있게 해 주세요.", [5] = "맛있게 드세요! 마음에 드셨다면 리뷰를 남겨 주세요.", [2] = "취소를 요청하지 않으셨다면 매장으로 연락해 주세요." },
                    "계정 활성화 코드", "계정을 활성화하는 코드입니다:", "비밀번호 재설정 코드", "비밀번호를 재설정하는 코드입니다:",
                    "코드는 {0}분 동안 유효합니다.", "요청하지 않으셨다면 이 메일을 무시하세요.",
                    "영업시간 {0}", "웹사이트에서 주문하거나 계정을 만드셔서 이 메일을 보내드립니다."),
                ["fr"] = new("fr",
                    "Commande {0} confirmée", "Merci pour votre commande, {0} !", "Nous avons bien reçu votre commande et vous appellerons très vite pour la confirmer. La cuisine commence dès la confirmation.", "Numéro de commande",
                    "Sous-total", "Remise", "Livraison", "Offerte", "Total", "Paiement", "Paiement à la livraison (COD)", "Livraison à", "Suivre ma commande",
                    "Commande {0} : {1}", "Bonjour {0},", "Votre commande <strong>{0}</strong> a été mise à jour :", "Message de la boutique",
                    new Dictionary<int, string> { [0] = "En attente", [1] = "Confirmée", [2] = "Annulée", [3] = "En préparation", [4] = "En livraison", [5] = "Livrée", [6] = "Remboursée" },
                    new Dictionary<int, string> { [3] = "La cuisine prépare votre repas.", [4] = "Votre livreur est en route, gardez votre téléphone à portée de main.", [5] = "Bon appétit ! Si vous avez aimé, laissez-nous un avis.", [2] = "Si vous n'avez pas demandé l'annulation, appelez la boutique." },
                    "Votre code d'activation", "Voici le code pour activer votre compte :", "Votre code de réinitialisation", "Voici le code pour réinitialiser votre mot de passe :",
                    "Le code est valable {0} minutes.", "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
                    "Ouvert {0}", "Vous recevez cet e-mail parce que vous avez commandé ou créé un compte sur notre site."),
            };
        }
    }
}
