using System.Security.Claims;
using Hyoka.Domain.Entities;
using Hyoka.Domain.Enums;
using Hyoka.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Api.Middleware;

public sealed class UserProvisioningMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, HyokaDbContext db)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var externalId = context.User.FindFirstValue("sub")
                ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!string.IsNullOrWhiteSpace(externalId))
            {
                var existing = await db.Users.FirstOrDefaultAsync(x => x.ClerkUserId == externalId);
                var email = context.User.FindFirstValue("email")
                    ?? context.User.FindFirstValue(ClaimTypes.Email)
                    ?? $"{externalId}@unknown.local";

                var role = context.User.HasClaim("role", UserRole.Admin) || context.User.HasClaim(ClaimTypes.Role, UserRole.Admin)
                    ? UserRole.Admin
                    : UserRole.User;

                if (existing is null)
                {
                    db.Users.Add(new User
                    {
                        ClerkUserId = externalId,
                        Email = email,
                        Role = role,
                        TimezoneMetadata = "UTC",
                        CreatedAtUtc = DateTime.UtcNow
                    });
                    await db.SaveChangesAsync();
                }
                else
                {
                    var changed = false;
                    if (!string.Equals(existing.Email, email, StringComparison.OrdinalIgnoreCase))
                    {
                        existing.Email = email;
                        changed = true;
                    }

                    if (!string.Equals(existing.Role, role, StringComparison.OrdinalIgnoreCase))
                    {
                        existing.Role = role;
                        changed = true;
                    }

                    if (changed)
                    {
                        await db.SaveChangesAsync();
                    }
                }
            }
        }

        await next(context);
    }
}
