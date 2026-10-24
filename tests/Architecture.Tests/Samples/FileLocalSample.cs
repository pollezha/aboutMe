namespace Architecture.Tests.Samples;

// Образец для Reader_sees_references_from_signatures_and_method_bodies: file-local тип в корне сборки должен
// читаться как обычный тип своего слоя, иначе `file class` обходит правила слоёв.
file static class FileLocalSample
{
    public static int LayerCount() => LayerRules.LayersOf("Svc").Count;
}
