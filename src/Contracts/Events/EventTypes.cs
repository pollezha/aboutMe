namespace Contracts.Events;

/// <summary>
/// Event types of <see cref="Topics.SiteEvents"/>. This file is the single source of event types and allowed
/// field values; design §5.4 refers here.
/// </summary>
public static class EventTypes
{
    public const string Visit = "visit";
    public const string StopOpened = "stop_opened";
    public const string SkillOpened = "skill_opened";
    public const string CtaClick = "cta_click";
    public const string WebVital = "web_vital";

    public static readonly IReadOnlyList<string> All = [Visit, StopOpened, SkillOpened, CtaClick, WebVital];
}

public static class Langs
{
    public const string En = "en";
    public const string Ru = "ru";

    public static readonly IReadOnlyList<string> All = [En, Ru];
}

public static class Themes
{
    public const string Day = "day";
    public const string Evening = "evening";
    public const string Night = "night";

    public static readonly IReadOnlyList<string> All = [Day, Evening, Night];
}

/// <summary>Device class, set by events-api from the request (the browser does not send it).</summary>
public static class Devices
{
    public const string Desktop = "desktop";
    public const string Mobile = "mobile";

    public static readonly IReadOnlyList<string> All = [Desktop, Mobile];
}

/// <summary><c>visit.source</c>: the <c>?src=</c> query parameter (FR12, metric M4).</summary>
public static class VisitSources
{
    public const string Hh = "hh";
    public const string LinkedIn = "linkedin";
    public const string Telegram = "tg";
    public const string Cv = "cv";
    public const string Direct = "direct";

    public static readonly IReadOnlyList<string> All = [Hh, LinkedIn, Telegram, Cv, Direct];
}

/// <summary>
/// <c>stop_opened.stop</c> values: the chapter ids of the content (keys of <c>chapters</c> in
/// <c>content/*.json</c>). A closed list keeps the stats and live counters bounded.
/// </summary>
public static class Stops
{
    public const string Profile = "profile";
    public const string ProSpace = "prospace";
    public const string TimePath = "timepath";
    public const string TechStack = "techstack";
    public const string Education = "education";
    public const string Contact = "contact";
    public const string Summary = "summary";
    public const string Monitoring = "monitoring";

    public static readonly IReadOnlyList<string> All =
        [Profile, ProSpace, TimePath, TechStack, Education, Contact, Summary, Monitoring];
}

/// <summary><c>cta_click.cta</c> values.</summary>
public static class CtaTargets
{
    public const string Contact = "contact";
    public const string Cv = "cv";
    public const string Telegram = "telegram";
    public const string GitHub = "github";
    public const string Hh = "hh";
    public const string Email = "email";
    public const string Bottle = "bottle";

    public static readonly IReadOnlyList<string> All = [Contact, Cv, Telegram, GitHub, Hh, Email, Bottle];
}

/// <summary><c>web_vital.name</c> values.</summary>
public static class WebVitalNames
{
    public const string Lcp = "LCP";
    public const string Cls = "CLS";
    public const string Inp = "INP";
    public const string Ttfb = "TTFB";
    public const string Fcp = "FCP";

    public static readonly IReadOnlyList<string> All = [Lcp, Cls, Inp, Ttfb, Fcp];
}

/// <summary>Limits of incoming event fields.</summary>
public static class EventLimits
{
    public const int SkillMaxLength = 64;
    public const int SessionIdMaxLength = 64;

    /// <summary>Allowed difference between <c>occurredAt</c> (browser clock) and server time, both ways.</summary>
    public static readonly TimeSpan OccurredAtTolerance = TimeSpan.FromHours(24);
}
