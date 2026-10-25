using System.Text;
using System.Text.Json;
using Anthropic.Models.Beta.Messages;
using JapaneseFood.Service.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace JapaneseFood.Service.Ai
{
    /// <param name="Kind">dish | category | section | policy: changes the tone the model aims for</param>
    /// <param name="Fields">Vietnamese source text by field name (name, shortDescription, description, title, content)</param>
    /// <param name="Targets">Language codes to produce (en, ja, ko, fr)</param>
    public sealed record TranslateRequest(string Kind, IReadOnlyDictionary<string, string> Fields, IReadOnlyList<string> Targets);

    /// <summary>language -> field -> translated text. Drafts: staff review them before saving.</summary>
    public sealed record TranslateResult(IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Translations);

    public interface IAiTranslator
    {
        bool IsConfigured { get; }
        Task<TranslateResult> TranslateAsync(TranslateRequest request, CancellationToken ct = default);
    }

    /// <summary>
    /// Drafts translations of menu and store content with Claude. The answer is constrained to a JSON schema
    /// (one object per target language with exactly the requested fields), so it can't come back malformed.
    /// </summary>
    public class AiTranslator(AnthropicClientProvider provider, IOptions<AiOptions> options, ILogger<AiTranslator> logger) : IAiTranslator
    {
        public static readonly IReadOnlySet<string> AllowedFields = new HashSet<string> { "name", "shortDescription", "description", "title", "content" };
        public static readonly IReadOnlySet<string> AllowedKinds = new HashSet<string> { "dish", "category", "section", "policy" };
        private const int MaxSourceLength = 12_000;

        private const string SystemPrompt =
            """
            You translate the website content of VQT Japanese Food, a Japanese restaurant in Vietnam, from Vietnamese into other languages.

            Write each language the way a native copywriter for a premium restaurant would: natural and appetizing for menu text, precise and clear for policies. Translate the meaning, not word for word.

            Keep Japanese dish names recognisable. In English and French use the usual romanized names (Sashimi, Nigiri, Wagyu A5, Matcha, Mochi). In Japanese use the natural Japanese name (刺身, 握り寿司, カツ丼, 抹茶). In Korean use the names Korean diners know.

            Keep every fact exactly as given: numbers, sizes such as 180ml, prices, quantities, ingredients, allergens, times and conditions. Do not add, drop or soften any information, claim or promise.

            Keep the line breaks and simple lists of the source. Plain text only, no Markdown. Japanese uses polite です/ます style; Korean uses polite 해요/합니다 style; French addresses the reader as "vous".
            """;

        public bool IsConfigured => provider.IsConfigured;

        public async Task<TranslateResult> TranslateAsync(TranslateRequest request, CancellationToken ct = default)
        {
            var (fields, targets) = Validate(request);
            if (provider.Client is null) throw new AppException(503, "ai_unavailable", "AI translation is not configured.");

            BetaMessage response;
            try
            {
                response = await provider.Client.Beta.Messages.Create(BuildParams(request.Kind, fields, targets), ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "AI translation request failed");
                throw new AppException(502, "ai_failed", "The translation service did not answer. Please try again.");
            }

            var stop = response.StopReason?.Raw();
            if (stop == "refusal") throw new AppException(422, "ai_refused", "The text could not be translated automatically.");
            if (stop == "max_tokens") throw new AppException(502, "ai_failed", "The translation was cut off. Try a shorter text.");

            var text = new StringBuilder();
            foreach (var block in response.Content)
                if (block.TryPickText(out var t)) text.Append(t.Text);
            return Parse(text.ToString(), fields.Keys.ToList(), targets);
        }

        /// <summary>Checks the request before anything is sent (unknown fields, empty text, unsupported languages).</summary>
        internal static (Dictionary<string, string> Fields, List<string> Targets) Validate(TranslateRequest request)
        {
            if (!AllowedKinds.Contains(request.Kind)) throw AppException.BadRequest("invalid_kind", "Unknown content kind.");
            var fields = request.Fields
                .Where(f => AllowedFields.Contains(f.Key) && !string.IsNullOrWhiteSpace(f.Value))
                .ToDictionary(f => f.Key, f => f.Value.Trim());
            if (fields.Count == 0) throw AppException.BadRequest("nothing_to_translate", "Fill in the Vietnamese text first.");
            if (fields.Values.Sum(v => v.Length) > MaxSourceLength) throw AppException.BadRequest("too_long", "The text is too long to translate at once.");
            var targets = request.Targets.Distinct().Where(l => Languages.Supported.Contains(l) && l != Languages.Default).ToList();
            if (targets.Count == 0) throw AppException.BadRequest("invalid_language", "Choose at least one target language.");
            return (fields, targets);
        }

        internal MessageCreateParams BuildParams(string kind, IReadOnlyDictionary<string, string> fields, IReadOnlyList<string> targets)
        {
            var user = $"Translate this {kind} from Vietnamese into: {string.Join(", ", targets)}. " +
                       "Return every field for every language.\n\n" +
                       JsonSerializer.Serialize(fields, new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping, WriteIndented = true });
            return new MessageCreateParams
            {
                Model = options.Value.Model,
                MaxTokens = 16000,
                System = SystemPrompt,
                Messages = [new BetaMessageParam { Role = Role.User, Content = user }],
                // Medium effort: careful enough for menu copy, still quick for a button click
                OutputConfig = new BetaOutputConfig { Effort = Effort.Medium, Format = new BetaJsonOutputFormat { Schema = Schema(fields.Keys, targets) } },
                Betas = [AnthropicClientProvider.FallbackBeta],
                Fallbacks = new BetaFallbacksParam(new Default()),
            };
        }

        /// <summary>{ "en": { "name": string, ... }, "ja": { ... } } with every key required and nothing else allowed.</summary>
        internal static Dictionary<string, JsonElement> Schema(IEnumerable<string> fields, IEnumerable<string> targets)
        {
            var fieldList = fields.ToList();
            var perLanguage = new
            {
                type = "object",
                properties = fieldList.ToDictionary(f => f, _ => new { type = "string" }),
                required = fieldList,
                additionalProperties = false,
            };
            var targetList = targets.ToList();
            return new Dictionary<string, JsonElement>
            {
                ["type"] = JsonSerializer.SerializeToElement("object"),
                ["properties"] = JsonSerializer.SerializeToElement(targetList.ToDictionary(l => l, _ => perLanguage)),
                ["required"] = JsonSerializer.SerializeToElement(targetList),
                ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
            };
        }

        internal static TranslateResult Parse(string json, IReadOnlyList<string> fields, IReadOnlyList<string> targets)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var result = new Dictionary<string, IReadOnlyDictionary<string, string>>();
                foreach (var lang in targets)
                {
                    if (!doc.RootElement.TryGetProperty(lang, out var obj) || obj.ValueKind != JsonValueKind.Object) continue;
                    var values = fields
                        .Where(f => obj.TryGetProperty(f, out var v) && v.ValueKind == JsonValueKind.String)
                        .ToDictionary(f => f, f => obj.GetProperty(f).GetString()!.Trim());
                    result[lang] = values;
                }
                if (result.Count == 0) throw new JsonException("No languages in the answer.");
                return new TranslateResult(result);
            }
            catch (JsonException)
            {
                throw new AppException(502, "ai_failed", "The translation came back in an unexpected format. Please try again.");
            }
        }
    }
}
