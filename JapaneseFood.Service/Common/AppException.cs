namespace JapaneseFood.Service.Common
{
    /// <summary>
    /// Expected business error. <see cref="Code"/> is a stable machine-readable key the frontend
    /// translates (e.g. "out_of_stock"); <see cref="Message"/> is an English fallback for logs/devs.
    /// </summary>
    public class AppException : Exception
    {
        public string Code { get; }
        public int StatusCode { get; }
        public IReadOnlyDictionary<string, object?>? Details { get; }

        public AppException(int statusCode, string code, string message, IReadOnlyDictionary<string, object?>? data = null)
            : base(message)
        {
            StatusCode = statusCode;
            Code = code;
            Details = data;
        }

        public static AppException BadRequest(string code, string message, IReadOnlyDictionary<string, object?>? data = null)
            => new(400, code, message, data);

        public static AppException Unauthorized(string code, string message)
            => new(401, code, message);

        public static AppException Forbidden(string code, string message)
            => new(403, code, message);

        public static AppException NotFound(string code, string message)
            => new(404, code, message);

        public static AppException Conflict(string code, string message, IReadOnlyDictionary<string, object?>? data = null)
            => new(409, code, message, data);
    }
}
