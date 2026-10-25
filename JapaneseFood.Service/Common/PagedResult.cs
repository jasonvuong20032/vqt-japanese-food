namespace JapaneseFood.Service.Common
{
    public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalItems)
    {
        public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalItems / (double)PageSize);
    }

    public static class Paging
    {
        public static (int Page, int PageSize) Normalize(int page, int pageSize, int defaultSize = 24, int maxSize = 60)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = defaultSize;
            if (pageSize > maxSize) pageSize = maxSize;
            return (page, pageSize);
        }
    }
}
