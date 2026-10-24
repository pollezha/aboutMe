namespace ContentApi.Application.Abstractions;

/// <summary>Итог сида при старте; его показывает <c>/health</c>.</summary>
public interface IContentSeedState
{
    void Succeeded(string description);

    void Failed(string description);
}
