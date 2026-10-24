using System.Collections.Immutable;
using System.Reflection;
using System.Reflection.Emit;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;

namespace Architecture.Tests;

/// <summary>
/// Читает скомпилированные сборки сервисов через System.Reflection.Metadata: для каждого типа — все типы, на которые
/// он ссылается в сигнатурах, атрибутах и IL тел методов. Вложенные типы (замыкания, state machine) слиты во внешний,
/// служебные типы компилятора (<c>&lt;PrivateImplementationDetails&gt;</c>, embedded-атрибуты, file-local типы генераторов вне namespace сервиса) пропущены.
/// </summary>
public static class ServiceAssemblies
{
    /// <summary>Сборки собираются вместе с тестами: ProjectReference с ReferenceOutputAssembly=false в csproj.</summary>
    public static IReadOnlyList<string> Projects { get; } =
    [
        "services/content-api",
        "services/events-api",
        "services/gateway",
        "services/live-hub",
        "services/projector",
    ];

    private static readonly Dictionary<short, OperandType> OperandTypes = typeof(OpCodes)
        .GetFields(BindingFlags.Public | BindingFlags.Static)
        .Select(f => (OpCode)f.GetValue(null)!)
        .ToDictionary(op => op.Value, op => op.OperandType);

    public static ServiceAssembly Load(string root, string project)
    {
        var projectDir = Path.Combine(root, project);
        var csproj = Directory.EnumerateFiles(projectDir, "*.csproj").Single();
        var name = Path.GetFileNameWithoutExtension(csproj);

        // Тот же bin/<Configuration>/<TFM>, что у сборки тестов
        var outputDir = Path.GetRelativePath(Path.Combine(root, "tests", "Architecture.Tests"), AppContext.BaseDirectory);
        var dll = Path.Combine(projectDir, outputDir, name + ".dll");
        if (!File.Exists(dll))
        {
            throw new FileNotFoundException($"{dll} not found: build {project} first", dll);
        }

        return LoadFile(name, dll);
    }

    /// <summary>Сборка по пути к dll; <paramref name="name"/> — имя сборки и корневой namespace сервиса.</summary>
    public static ServiceAssembly LoadFile(string name, string dll)
    {
        using var stream = File.OpenRead(dll);
        using var pe = new PEReader(stream);
        return Read(name, pe);
    }

    private static ServiceAssembly Read(string name, PEReader pe)
    {
        var reader = pe.GetMetadataReader();
        var context = new ReadContext(name, reader);
        var types = new List<TypeDependencies>();

        foreach (var handle in reader.TypeDefinitions)
        {
            var definition = reader.GetTypeDefinition(handle);
            if (!definition.GetDeclaringType().IsNil || context.IsCompilerService(handle))
            {
                continue;
            }

            var references = new HashSet<TypeReferenceInfo>();
            CollectType(context, pe, handle, references);
            types.Add(new TypeDependencies(context.FullName(handle), context.Namespace(handle), [.. references]));
        }

        return new ServiceAssembly(name, types);
    }

    /// <summary>Тип и все вложенные в него: базовый тип, интерфейсы, атрибуты, поля, методы с телами, свойства, события.</summary>
    private static void CollectType(ReadContext context, PEReader pe, TypeDefinitionHandle handle, HashSet<TypeReferenceInfo> references)
    {
        var reader = context.Reader;
        var definition = reader.GetTypeDefinition(handle);

        context.Add(definition.BaseType, references);
        foreach (var implementation in definition.GetInterfaceImplementations())
        {
            context.Add(reader.GetInterfaceImplementation(implementation).Interface, references);
        }

        context.AddAttributes(definition.GetCustomAttributes(), references);
        context.AddGenericParameters(definition.GetGenericParameters(), references);

        foreach (var fieldHandle in definition.GetFields())
        {
            var field = reader.GetFieldDefinition(fieldHandle);
            references.UnionWith(field.DecodeSignature(context.Provider, null));
            context.AddAttributes(field.GetCustomAttributes(), references);
        }

        foreach (var methodHandle in definition.GetMethods())
        {
            var method = reader.GetMethodDefinition(methodHandle);
            ReadContext.AddMethodSignature(method.DecodeSignature(context.Provider, null), references);
            context.AddAttributes(method.GetCustomAttributes(), references);
            context.AddGenericParameters(method.GetGenericParameters(), references);
            foreach (var parameter in method.GetParameters())
            {
                context.AddAttributes(reader.GetParameter(parameter).GetCustomAttributes(), references);
            }

            if (method.RelativeVirtualAddress != 0)
            {
                CollectBody(context, pe.GetMethodBody(method.RelativeVirtualAddress), references);
            }
        }

        foreach (var propertyHandle in definition.GetProperties())
        {
            var property = reader.GetPropertyDefinition(propertyHandle);
            ReadContext.AddMethodSignature(property.DecodeSignature(context.Provider, null), references);
            context.AddAttributes(property.GetCustomAttributes(), references);
        }

        foreach (var eventHandle in definition.GetEvents())
        {
            var @event = reader.GetEventDefinition(eventHandle);
            context.Add(@event.Type, references);
            context.AddAttributes(@event.GetCustomAttributes(), references);
        }

        foreach (var nested in definition.GetNestedTypes())
        {
            CollectType(context, pe, nested, references);
        }
    }

    /// <summary>Локальные переменные и все токены в IL: вызовы, поля, new, typeof, касты.</summary>
    private static void CollectBody(ReadContext context, MethodBodyBlock body, HashSet<TypeReferenceInfo> references)
    {
        if (!body.LocalSignature.IsNil)
        {
            context.Add(body.LocalSignature, references);
        }

        var il = body.GetILReader();
        while (il.RemainingBytes > 0)
        {
            short value = il.ReadByte();
            if (value == 0xFE)
            {
                value = unchecked((short)(0xFE00 | il.ReadByte()));
            }

            switch (OperandTypes[value])
            {
                case OperandType.InlineField:
                case OperandType.InlineMethod:
                case OperandType.InlineTok:
                case OperandType.InlineType:
                case OperandType.InlineSig:
                    context.Add(MetadataTokens.EntityHandle(il.ReadInt32()), references);
                    break;
                case OperandType.InlineSwitch:
                    il.Offset += il.ReadInt32() * 4;
                    break;
                case OperandType.InlineNone:
                    break;
                case OperandType.ShortInlineBrTarget:
                case OperandType.ShortInlineI:
                case OperandType.ShortInlineVar:
                    il.Offset += 1;
                    break;
                case OperandType.InlineVar:
                    il.Offset += 2;
                    break;
                case OperandType.InlineI8:
                case OperandType.InlineR:
                    il.Offset += 8;
                    break;
                default:
                    il.Offset += 4;
                    break;
            }
        }
    }

    private sealed class ReadContext
    {
        public ReadContext(string assembly, MetadataReader reader)
        {
            Assembly = assembly;
            Reader = reader;
            Provider = new SignatureTypes(this);
        }

        public string Assembly { get; }

        public MetadataReader Reader { get; }

        public SignatureTypes Provider { get; }

        public void Add(EntityHandle handle, HashSet<TypeReferenceInfo> references)
        {
            if (handle.IsNil)
            {
                return;
            }

            switch (handle.Kind)
            {
                case HandleKind.TypeDefinition:
                case HandleKind.TypeReference:
                case HandleKind.TypeSpecification:
                    references.UnionWith(Provider.FromHandle(Reader, handle));
                    break;
                case HandleKind.MethodDefinition:
                    Add(Reader.GetMethodDefinition((MethodDefinitionHandle)handle).GetDeclaringType(), references);
                    break;
                case HandleKind.FieldDefinition:
                    Add(Reader.GetFieldDefinition((FieldDefinitionHandle)handle).GetDeclaringType(), references);
                    break;
                case HandleKind.MemberReference:
                    var member = Reader.GetMemberReference((MemberReferenceHandle)handle);
                    Add(member.Parent, references);
                    if (member.GetKind() == MemberReferenceKind.Method)
                    {
                        AddMethodSignature(member.DecodeMethodSignature(Provider, null), references);
                    }
                    else
                    {
                        references.UnionWith(member.DecodeFieldSignature(Provider, null));
                    }

                    break;
                case HandleKind.MethodSpecification:
                    var specification = Reader.GetMethodSpecification((MethodSpecificationHandle)handle);
                    Add(specification.Method, references);
                    foreach (var argument in specification.DecodeSignature(Provider, null))
                    {
                        references.UnionWith(argument);
                    }

                    break;
                case HandleKind.StandaloneSignature:
                    var signature = Reader.GetStandaloneSignature((StandaloneSignatureHandle)handle);
                    if (signature.GetKind() == StandaloneSignatureKind.LocalVariables)
                    {
                        foreach (var local in signature.DecodeLocalSignature(Provider, null))
                        {
                            references.UnionWith(local);
                        }
                    }
                    else
                    {
                        AddMethodSignature(signature.DecodeMethodSignature(Provider, null), references);
                    }

                    break;
            }
        }

        public static void AddMethodSignature(MethodSignature<ImmutableArray<TypeReferenceInfo>> signature, HashSet<TypeReferenceInfo> references)
        {
            references.UnionWith(signature.ReturnType);
            foreach (var parameter in signature.ParameterTypes)
            {
                references.UnionWith(parameter);
            }
        }

        public void AddAttributes(CustomAttributeHandleCollection attributes, HashSet<TypeReferenceInfo> references)
        {
            foreach (var attribute in attributes)
            {
                Add(Reader.GetCustomAttribute(attribute).Constructor, references);
            }
        }

        public void AddGenericParameters(GenericParameterHandleCollection parameters, HashSet<TypeReferenceInfo> references)
        {
            foreach (var parameter in parameters)
            {
                foreach (var constraint in Reader.GetGenericParameter(parameter).GetConstraints())
                {
                    Add(Reader.GetGenericParameterConstraint(constraint).Type, references);
                }
            }
        }

        /// <summary>Самый внешний объявляющий тип.</summary>
        public TypeDefinitionHandle Outermost(TypeDefinitionHandle handle)
        {
            while (true)
            {
                var declaring = Reader.GetTypeDefinition(handle).GetDeclaringType();
                if (declaring.IsNil)
                {
                    return handle;
                }

                handle = declaring;
            }
        }

        public string Namespace(TypeDefinitionHandle handle) =>
            Reader.GetString(Reader.GetTypeDefinition(Outermost(handle)).Namespace);

        public string FullName(TypeDefinitionHandle handle)
        {
            var definition = Reader.GetTypeDefinition(Outermost(handle));
            var ns = Reader.GetString(definition.Namespace);
            var name = Reader.GetString(definition.Name);
            return ns.Length == 0 ? name : $"{ns}.{name}";
        }

        /// <summary>
        /// Служебный тип компилятора или генератора: имя в угловых скобках вне корневого namespace сервиса
        /// (анонимные типы, <c>&lt;PrivateImplementationDetails&gt;</c>, file-local типы генераторов) или
        /// embedded-атрибут (<c>NullableAttribute</c> и т. п.). File-local тип в namespace сервиса
        /// (<c>&lt;File&gt;F…__Name</c>) — обычный тип своего слоя, иначе <c>file class</c> обходит правила слоёв.
        /// </summary>
        public bool IsCompilerService(TypeDefinitionHandle handle)
        {
            var definition = Reader.GetTypeDefinition(Outermost(handle));
            if (Reader.GetString(definition.Name).StartsWith('<'))
            {
                var ns = Reader.GetString(definition.Namespace);
                return ns != Assembly && !ns.StartsWith(Assembly + ".", StringComparison.Ordinal);
            }

            foreach (var attribute in definition.GetCustomAttributes())
            {
                var constructor = Reader.GetCustomAttribute(attribute).Constructor;
                if (constructor.Kind == HandleKind.MethodDefinition
                    && Reader.GetString(Reader.GetTypeDefinition(Reader.GetMethodDefinition((MethodDefinitionHandle)constructor).GetDeclaringType()).Name) == "EmbeddedAttribute")
                {
                    return true;
                }
            }

            return false;
        }
    }

    /// <summary>Тип из сигнатуры → множество именованных типов в нём (generic-аргументы, элементы массивов).</summary>
    private sealed class SignatureTypes(ReadContext context) : ISignatureTypeProvider<ImmutableArray<TypeReferenceInfo>, object?>
    {
        public ImmutableArray<TypeReferenceInfo> FromHandle(MetadataReader reader, EntityHandle handle) => handle.Kind switch
        {
            HandleKind.TypeDefinition => GetTypeFromDefinition(reader, (TypeDefinitionHandle)handle, 0),
            HandleKind.TypeReference => GetTypeFromReference(reader, (TypeReferenceHandle)handle, 0),
            HandleKind.TypeSpecification => GetTypeFromSpecification(reader, null, (TypeSpecificationHandle)handle, 0),
            _ => [],
        };

        public ImmutableArray<TypeReferenceInfo> GetTypeFromDefinition(MetadataReader reader, TypeDefinitionHandle handle, byte rawTypeKind) =>
            context.IsCompilerService(handle)
                ? []
                : [new TypeReferenceInfo(context.Assembly, context.Namespace(handle), context.FullName(handle))];

        public ImmutableArray<TypeReferenceInfo> GetTypeFromReference(MetadataReader reader, TypeReferenceHandle handle, byte rawTypeKind)
        {
            // Вложенный тип: namespace и сборка — у внешнего
            var outer = reader.GetTypeReference(handle);
            while (outer.ResolutionScope.Kind == HandleKind.TypeReference)
            {
                outer = reader.GetTypeReference((TypeReferenceHandle)outer.ResolutionScope);
            }

            var assembly = outer.ResolutionScope.Kind == HandleKind.AssemblyReference
                ? reader.GetString(reader.GetAssemblyReference((AssemblyReferenceHandle)outer.ResolutionScope).Name)
                : context.Assembly;
            var ns = reader.GetString(outer.Namespace);
            var name = reader.GetString(outer.Name);
            return [new TypeReferenceInfo(assembly, ns, ns.Length == 0 ? name : $"{ns}.{name}")];
        }

        public ImmutableArray<TypeReferenceInfo> GetTypeFromSpecification(MetadataReader reader, object? genericContext, TypeSpecificationHandle handle, byte rawTypeKind) =>
            reader.GetTypeSpecification(handle).DecodeSignature(this, genericContext);

        public ImmutableArray<TypeReferenceInfo> GetGenericInstantiation(ImmutableArray<TypeReferenceInfo> genericType, ImmutableArray<ImmutableArray<TypeReferenceInfo>> typeArguments) =>
            [.. genericType, .. typeArguments.SelectMany(a => a)];

        public ImmutableArray<TypeReferenceInfo> GetFunctionPointerType(MethodSignature<ImmutableArray<TypeReferenceInfo>> signature) =>
            [.. signature.ReturnType, .. signature.ParameterTypes.SelectMany(p => p)];

        public ImmutableArray<TypeReferenceInfo> GetModifiedType(ImmutableArray<TypeReferenceInfo> modifier, ImmutableArray<TypeReferenceInfo> unmodifiedType, bool isRequired) => unmodifiedType;

        public ImmutableArray<TypeReferenceInfo> GetArrayType(ImmutableArray<TypeReferenceInfo> elementType, ArrayShape shape) => elementType;

        public ImmutableArray<TypeReferenceInfo> GetSZArrayType(ImmutableArray<TypeReferenceInfo> elementType) => elementType;

        public ImmutableArray<TypeReferenceInfo> GetByReferenceType(ImmutableArray<TypeReferenceInfo> elementType) => elementType;

        public ImmutableArray<TypeReferenceInfo> GetPointerType(ImmutableArray<TypeReferenceInfo> elementType) => elementType;

        public ImmutableArray<TypeReferenceInfo> GetPinnedType(ImmutableArray<TypeReferenceInfo> elementType) => elementType;

        public ImmutableArray<TypeReferenceInfo> GetPrimitiveType(PrimitiveTypeCode typeCode) => [];

        public ImmutableArray<TypeReferenceInfo> GetGenericMethodParameter(object? genericContext, int index) => [];

        public ImmutableArray<TypeReferenceInfo> GetGenericTypeParameter(object? genericContext, int index) => [];
    }
}
