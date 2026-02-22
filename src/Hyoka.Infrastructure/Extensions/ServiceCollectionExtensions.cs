using Hyoka.Application.Abstractions;
using Hyoka.Application.Services;
using Hyoka.Infrastructure.Data;
using Hyoka.Infrastructure.Options;
using Hyoka.Infrastructure.Services;
using Hyoka.Infrastructure.Services.Providers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Hyoka.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddHyokaInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        services.Configure<ProviderRuntimeOptions>(configuration.GetSection(ProviderRuntimeOptions.SectionName));
        services.Configure<StripeOptions>(configuration.GetSection(StripeOptions.SectionName));
        services.Configure<ClerkOptions>(configuration.GetSection(ClerkOptions.SectionName));

        var dbProvider = configuration["Database:Provider"];
        if (string.Equals(dbProvider, "InMemory", StringComparison.OrdinalIgnoreCase))
        {
            services.AddDbContext<HyokaDbContext>(opt =>
                opt.UseInMemoryDatabase(configuration["Database:Name"] ?? "hyoka-tests"));
        }
        else
        {
            services.AddDbContext<HyokaDbContext>(opt =>
                opt.UseNpgsql(configuration.GetConnectionString("Postgres")));
        }

        services.AddHttpClient();

        services.AddScoped<IPlanService, PlanService>();
        services.AddScoped<IUsageService, UsageService>();
        services.AddScoped<IMemoryService, MemoryService>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        services.AddScoped<IProviderGateway, ProviderGateway>();
        services.AddScoped<IBillingService, StripeBillingService>();

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IRpmLimiter, InMemoryRpmLimiter>();
        services.AddSingleton<ITokenEstimator, TokenEstimator>();
        services.AddSingleton<IDocumentExtractor, DocumentExtractor>();
        services.AddSingleton<IObjectStorage, S3ObjectStorage>();

        services.AddScoped<OpenAiProviderClient>();
        services.AddScoped<OpenRouterProviderClient>();
        services.AddScoped<AnthropicProviderClient>();
        services.AddScoped<MockProviderClient>();
        services.AddScoped<IProviderClientFactory, ProviderClientFactory>();

        return services;
    }
}
