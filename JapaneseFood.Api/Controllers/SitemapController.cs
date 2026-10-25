using JapaneseFood.Entity;
using JapaneseFood.Service.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Xml;

namespace JapaneseFood.Api.Controllers
{
    /// <summary>XML sitemap so search engines find every product and menu page (each listed once per language).</summary>
    [ApiController]
    public class SitemapController(DataContext db, IConfiguration config) : ControllerBase
    {
        [HttpGet("/sitemap.xml")]
        [OutputCache(Duration = 3600)]
        public async Task<IActionResult> Sitemap(CancellationToken ct)
        {
            var baseUrl = (config["Site:PublicUrl"] ?? $"{Request.Scheme}://{Request.Host}").TrimEnd('/');

            var products = await db.Products.AsNoTracking()
                .Where(p => !p.IsDelete && p.IsActive && p.Slug != null)
                .Select(p => new { p.Slug, p.UpdatedAt, p.CreatedAt })
                .ToListAsync(ct);
            var catalogs = await db.Catalogs.AsNoTracking()
                .Where(c => !c.IsDelete && c.IsActive && c.Slug != null)
                .Select(c => c.Slug)
                .ToListAsync(ct);

            var urls = new List<(string Path, DateTime? Modified, string Priority)>
            {
                ("/", null, "1.0"), ("/menu", null, "0.9"), ("/about", null, "0.6"), ("/policies", null, "0.4"),
            };
            urls.AddRange(catalogs.Select(slug => ($"/menu/{slug}", (DateTime?)null, "0.8")));
            urls.AddRange(products.Select(p => ($"/p/{p.Slug}", (DateTime?)(p.UpdatedAt == default ? p.CreatedAt : p.UpdatedAt), "0.7")));

            var sb = new StringBuilder();
            using (var xml = XmlWriter.Create(sb, new XmlWriterSettings { Indent = true, Encoding = Encoding.UTF8 }))
            {
                xml.WriteStartDocument();
                xml.WriteStartElement("urlset", "http://www.sitemaps.org/schemas/sitemap/0.9");
                xml.WriteAttributeString("xmlns", "xhtml", null, "http://www.w3.org/1999/xhtml");
                foreach (var (path, modified, priority) in urls)
                {
                    xml.WriteStartElement("url");
                    xml.WriteElementString("loc", baseUrl + path);
                    if (modified.HasValue) xml.WriteElementString("lastmod", modified.Value.ToString("yyyy-MM-dd"));
                    xml.WriteElementString("priority", priority);
                    // hreflang alternates: the SPA switches language with ?lang=
                    foreach (var lang in Languages.Supported)
                    {
                        xml.WriteStartElement("xhtml", "link", "http://www.w3.org/1999/xhtml");
                        xml.WriteAttributeString("rel", "alternate");
                        xml.WriteAttributeString("hreflang", lang);
                        xml.WriteAttributeString("href", $"{baseUrl}{path}?lang={lang}");
                        xml.WriteEndElement();
                    }
                    xml.WriteEndElement();
                }
                xml.WriteEndElement();
            }

            return Content(sb.ToString().Replace("encoding=\"utf-16\"", "encoding=\"utf-8\""), "application/xml", Encoding.UTF8);
        }
    }
}
