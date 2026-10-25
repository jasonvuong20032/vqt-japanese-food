namespace JapaneseFood.Service.Ai
{
    /// <summary>Settings for the Claude-powered back office features (the "Ai" section of appsettings).</summary>
    public sealed class AiOptions
    {
        public const string Section = "Ai";

        public string Model { get; set; } = "claude-opus-5-5";
    }
}
