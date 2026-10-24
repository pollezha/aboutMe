using System.Diagnostics.CodeAnalysis;
using LiveHub.Application.Abstractions;

namespace LiveHub.Application.ApplyLiveEvent;

/// <summary>
/// Учитывает событие в живых счётчиках. Идемпотентен по <c>eventId</c>: повторная доставка и перечитывание
/// журнала с начала суток ничего не меняют. Когда разослать изменения, решает вызывающий по результату.
/// </summary>
[SuppressMessage(
    "Naming",
    "CA1711:Identifiers should not have incorrect suffix",
    Justification = "<Feature>Handler по ADR-0007; фича называется ApplyLiveEvent, это не делегат события")]
public sealed class ApplyLiveEventHandler(ILiveStateRepository state)
{
    /// <returns><c>true</c> — снапшот изменился, клиентам пора получить counters.</returns>
    public Task<bool> HandleAsync(ApplyLiveEventCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        return Task.FromResult(state.Apply(command.Event));
    }
}
