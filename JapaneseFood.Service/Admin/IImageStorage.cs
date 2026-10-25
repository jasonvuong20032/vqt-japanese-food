namespace JapaneseFood.Service.Admin
{
    /// <summary>Where uploaded images live. The API implements it on disk; swap for cloud storage later.</summary>
    public interface IImageStorage
    {
        /// <summary>Saves the image under a new random name and returns the value to store in the database (e.g. "/Uploads/Product/x.jpg").</summary>
        Task<string> SaveAsync(Stream content, string extension, string folder, CancellationToken ct = default);

        /// <summary>Saves (or overwrites) the image under a fixed file name. Used by seeding so re-runs don't pile up copies.</summary>
        Task<string> SaveNamedAsync(Stream content, string fileName, string folder, CancellationToken ct = default);

        Task DeleteAsync(string storedUrl, CancellationToken ct = default);
    }
}
