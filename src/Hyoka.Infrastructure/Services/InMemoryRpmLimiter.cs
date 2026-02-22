using Hyoka.Application.Abstractions;
using System.Collections.Concurrent;

namespace Hyoka.Infrastructure.Services;

public sealed class InMemoryRpmLimiter : IRpmLimiter
{
    private sealed record Bucket(DateTime WindowStartUtc, int Count);

    private readonly ConcurrentDictionary<Guid, Bucket> _buckets = new();

    public bool TryConsume(Guid userId, int limitPerMinute)
    {
        if (limitPerMinute <= 0)
        {
            return false;
        }

        var now = DateTime.UtcNow;

        while (true)
        {
            var current = _buckets.GetOrAdd(userId, _ => new Bucket(now, 0));
            var sameWindow = now - current.WindowStartUtc < TimeSpan.FromMinutes(1);

            var next = sameWindow
                ? current with { Count = current.Count + 1 }
                : new Bucket(now, 1);

            if (_buckets.TryUpdate(userId, next, current))
            {
                return next.Count <= limitPerMinute;
            }
        }
    }
}
