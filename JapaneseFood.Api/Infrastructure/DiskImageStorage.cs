using JapaneseFood.Service.Admin;
using JapaneseFood.Service.Common;

namespace JapaneseFood.Api.Infrastructure
{
    public sealed class StorageOptions
    {
        /// <summary>Physical folder served at /Uploads. Relative paths resolve from the API content root.</summary>
        public string UploadsPath { get; set; } = "../vqt_japanese_food_web/wwwroot/Uploads";
        public long MaxImageBytes { get; set; } = 5 * 1024 * 1024;
    }

    /// <summary>Stores images under the shared Uploads folder so the legacy MVC site and the API see the same files.</summary>
    public sealed class DiskImageStorage(string rootPath, ILogger<DiskImageStorage> logger) : IImageStorage
    {
        private static readonly string[] Folders = ["Product", "User", "Banner", "Content"];
        private static readonly string[] Extensions = [".jpg", ".jpeg", ".png", ".webp"];

        public async Task<string> SaveAsync(Stream content, string extension, string folder, CancellationToken ct = default)
            => await WriteAsync(content, $"{Guid.NewGuid()}{extension.ToLowerInvariant()}", folder, overwrite: false, ct);

        public async Task<string> SaveNamedAsync(Stream content, string fileName, string folder, CancellationToken ct = default)
        {
            // Only a plain file name is accepted, never a path
            if (fileName != Path.GetFileName(fileName) || fileName.Contains(".."))
                throw new ArgumentException("Invalid file name", nameof(fileName));
            return await WriteAsync(content, fileName, folder, overwrite: true, ct);
        }

        private async Task<string> WriteAsync(Stream content, string fileName, string folder, bool overwrite, CancellationToken ct)
        {
            if (!Folders.Contains(folder)) throw new ArgumentException("Unknown upload folder", nameof(folder));
            if (!Extensions.Contains(Path.GetExtension(fileName).ToLowerInvariant()))
                throw AppException.BadRequest("unsupported_image", "Only JPG, PNG and WebP images are allowed.");

            // Check the file really is an image (the extension alone is attacker-controlled)
            var header = new byte[12];
            var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
            if (!IsImage(header.AsSpan(0, read)))
                throw AppException.BadRequest("unsupported_image", "The file is not a valid image.");

            var dir = Path.Combine(rootPath, folder);
            Directory.CreateDirectory(dir);

            await using (var file = new FileStream(Path.Combine(dir, fileName), overwrite ? FileMode.Create : FileMode.CreateNew,
                             FileAccess.Write, FileShare.None, 81920, true))
            {
                await file.WriteAsync(header.AsMemory(0, read), ct);
                await content.CopyToAsync(file, ct);
            }

            return $"/Uploads/{folder}/{fileName}";
        }

        public Task DeleteAsync(string storedUrl, CancellationToken ct = default)
        {
            try
            {
                var relative = storedUrl.TrimStart('~').TrimStart('/');
                if (!relative.StartsWith("Uploads/", StringComparison.OrdinalIgnoreCase)) return Task.CompletedTask;

                var full = Path.GetFullPath(Path.Combine(rootPath, relative["Uploads/".Length..]));
                // Never delete outside the uploads root
                if (full.StartsWith(Path.GetFullPath(rootPath), StringComparison.OrdinalIgnoreCase) && File.Exists(full))
                    File.Delete(full);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not delete image {Url}", storedUrl);
            }
            return Task.CompletedTask;
        }

        private static bool IsImage(ReadOnlySpan<byte> h)
            => (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF)                       // JPEG
               || (h.Length >= 8 && h[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) // PNG
               || (h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8));          // WebP
    }
}
