using System.Net;
using Hyoka.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Hyoka.IntegrationTests;

public sealed class ApiSmokeTests : IClassFixture<HyokaApiFactory>
{
    private readonly HyokaApiFactory _factory;

    public ApiSmokeTests(HyokaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AuthMe_ReturnsUserAndPlan_ForDevAuth()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("x-dev-user-id", "integration-user");
        client.DefaultRequestHeaders.Add("x-dev-email", "integration@example.com");

        var response = await client.GetAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("integration@example.com", json);
        Assert.Contains("Free", json);
    }
}

public sealed class HyokaApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.UseSetting("Database:Provider", "InMemory");
        builder.UseSetting("Database:Name", "hyoka-integration-tests");

        builder.ConfigureServices(services =>
        {
            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<HyokaDbContext>();
            db.Database.EnsureDeleted();
            DbSeeder.SeedAsync(db).GetAwaiter().GetResult();
        });
    }
}
