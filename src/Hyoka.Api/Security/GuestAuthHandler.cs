using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Hyoka.Api.Security;

public sealed class GuestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string GuestCookieName = "hyoka_guest_id";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var guestId = Request.Cookies[GuestCookieName];
        if (!Guid.TryParseExact(guestId, "N", out _))
        {
            guestId = Guid.NewGuid().ToString("N");
            var secureCookie = string.Equals(Request.Scheme, "https", StringComparison.OrdinalIgnoreCase);
            Response.Cookies.Append(GuestCookieName, guestId, new CookieOptions
            {
                HttpOnly = true,
                Secure = secureCookie,
                SameSite = SameSiteMode.Lax,
                MaxAge = TimeSpan.FromDays(365),
                IsEssential = true
            });
        }

        var externalId = $"guest:{guestId}";
        var email = $"guest-{guestId[..12]}@guest.local";

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, externalId),
            new("sub", externalId),
            new(ClaimTypes.Email, email),
            new("email", email),
            new(ClaimTypes.Role, "user"),
            new("role", "user"),
            new("guest", "true")
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
