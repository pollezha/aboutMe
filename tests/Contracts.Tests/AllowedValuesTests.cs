using System.Text.Json;
using Contracts.Events;
using Xunit;

namespace Contracts.Tests;

/// <summary>
/// Snapshot of the allowed values of <c>site.events.v1</c> (design §5.4). Changing a list is a contract change:
/// removing a value rejects events old clients still send, so the snapshot has to be updated on purpose.
/// </summary>
public sealed class AllowedValuesTests
{
    public static TheoryData<string, string[], string[]> Snapshot => new()
    {
        { "type", [.. EventTypes.All], ["visit", "stop_opened", "skill_opened", "cta_click", "web_vital"] },
        { "lang", [.. Langs.All], ["en", "ru"] },
        { "theme", [.. Themes.All], ["day", "evening", "night"] },
        { "device", [.. Devices.All], ["desktop", "mobile"] },
        { "visit.source", [.. VisitSources.All], ["hh", "linkedin", "tg", "cv", "direct"] },
        { "stop_opened.stop", [.. Stops.All], ["profile", "prospace", "timepath", "techstack", "education", "contact", "summary", "monitoring"] },
        { "cta_click.cta", [.. CtaTargets.All], ["contact", "cv", "telegram", "github", "hh", "email", "bottle"] },
        { "web_vital.name", [.. WebVitalNames.All], ["LCP", "CLS", "INP", "TTFB", "FCP"] },
    };

    [Theory]
    [MemberData(nameof(Snapshot))]
    public void Allowed_values_match_the_contract(string field, string[] actual, string[] expected) =>
        Assert.True(expected.SequenceEqual(actual), $"{field}: [{string.Join(", ", actual)}]");

    [Theory]
    [InlineData("en")]
    [InlineData("ru")]
    public void Stops_are_the_chapter_ids_of_the_content(string lang)
    {
        using var content = ReadContent(lang);

        var chapters = content.RootElement.GetProperty("chapters").EnumerateObject().Select(p => p.Name);

        Assert.Equal(chapters.Order(StringComparer.Ordinal), Stops.All.Order(StringComparer.Ordinal));
    }

    [Theory]
    [InlineData("en")]
    [InlineData("ru")]
    public void Every_tech_stack_server_name_is_a_valid_skill(string lang)
    {
        using var content = ReadContent(lang);
        var names = content.RootElement.GetProperty("chapters").GetProperty("techstack").GetProperty("racks")
            .EnumerateArray()
            .SelectMany(rack => rack.GetProperty("servers").EnumerateArray())
            .Select(server => server.GetProperty("name").GetString()!)
            .ToList();
        var validator = new EventValidator(TimeProvider.System);

        var invalid = names.Where(name => validator.Validate(SkillOpened(name)).Count > 0);

        Assert.NotEmpty(names);
        Assert.Empty(invalid);
    }

    private static IncomingEvent SkillOpened(string skill) =>
        new(
            "0192f5c4-6f1e-7c3a-9b2d-4e5f6a7b8c9d",
            EventTypes.SkillOpened,
            TimeProvider.System.GetUtcNow(),
            "browser-session",
            Langs.En,
            Themes.Day,
            JsonSerializer.SerializeToElement(new Dictionary<string, string> { ["skill"] = skill }));

    private static JsonDocument ReadContent(string lang)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "aboutMe.slnx")))
            {
                return JsonDocument.Parse(File.ReadAllText(Path.Combine(dir.FullName, "content", $"{lang}.json")));
            }
        }

        throw new InvalidOperationException($"aboutMe.slnx not found above {AppContext.BaseDirectory}");
    }
}
