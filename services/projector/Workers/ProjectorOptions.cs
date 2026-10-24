using Contracts;

namespace Projector.Workers;

/// <summary>Секция конфигурации <c>Projector</c>. В проде — значения по умолчанию; тесты подменяют топик и группу.</summary>
public sealed class ProjectorOptions
{
    public const string SectionName = "Projector";

    public string Topic { get; set; } = Topics.SiteEvents;

    public string ConsumerGroup { get; set; } = ConsumerGroups.Projector;
}
