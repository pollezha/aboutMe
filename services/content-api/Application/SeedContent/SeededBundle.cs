namespace ContentApi.Application.SeedContent;

/// <param name="Changed"><c>true</c> — хэш отличался и бандл записан заново.</param>
public sealed record SeededBundle(string Lang, string ContentVersion, string VersionHash, bool Changed);
