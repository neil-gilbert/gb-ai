namespace Hyoka.Application.Abstractions;

public interface IRpmLimiter
{
    bool TryConsume(Guid userId, int limitPerMinute);
}
