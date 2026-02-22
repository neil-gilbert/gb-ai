using System.Security.Claims;
using Hyoka.Domain.Entities;
using Hyoka.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Api.Extensions;

public static class HttpContextExtensions
{
    public static string? GetUserExternalId(this HttpContext context)
    {
        return context.User.FindFirstValue("sub")
            ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    public static async Task<User> RequireCurrentUserAsync(this HttpContext context, HyokaDbContext db, CancellationToken ct)
    {
        var externalId = context.GetUserExternalId();
        if (string.IsNullOrWhiteSpace(externalId))
        {
            throw new UnauthorizedAccessException("No authenticated user identifier found.");
        }

        var user = await db.Users.FirstOrDefaultAsync(x => x.ClerkUserId == externalId, ct);
        if (user is null)
        {
            throw new UnauthorizedAccessException("User not provisioned.");
        }

        return user;
    }

    public static bool IsAdmin(this ClaimsPrincipal principal)
    {
        return principal.HasClaim(ClaimTypes.Role, "admin") || principal.HasClaim("role", "admin");
    }
}
