using Hyoka.Application.Abstractions;

namespace Hyoka.Infrastructure.Services;

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
