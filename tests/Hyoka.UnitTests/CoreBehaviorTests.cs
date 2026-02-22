using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Application.Services;
using Hyoka.Domain.Entities;
using Hyoka.Infrastructure.Data;
using Hyoka.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Hyoka.UnitTests;

public sealed class CoreBehaviorTests
{
    [Fact]
    public void QuotaCalculator_ComputesWeightedCredits()
    {
        var credits = QuotaCalculator.ComputeCredits(100, 50, 1.1m, 2.5m);
        Assert.Equal(235.0m, credits);
    }

    [Fact]
    public async Task UsageService_Blocks_WhenDailyRequestLimitReached()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        db.DailyCounters.Add(new DailyCounter
        {
            UserId = userId,
            DayUtc = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestCount = 10,
            CreditsUsed = 100
        });
        await db.SaveChangesAsync();

        var service = new UsageService(db, new FixedClock(DateTime.UtcNow));
        var decision = await service.EvaluateBeforeRequestAsync(userId, new PlanUsageContext
        {
            PlanName = "Free",
            RequestsPerMinute = 5,
            RequestsPerDay = 10,
            RequestsPerMonth = 999,
            CreditsPerDay = 999,
            CreditsPerMonth = 9999,
            MonthCycleKey = DateTime.UtcNow.ToString("yyyy-MM-01")
        }, CancellationToken.None);

        Assert.False(decision.Allowed);
        Assert.Contains("Daily request", decision.Reason);
    }

    [Fact]
    public async Task ProviderGateway_UsesFallback_WhenPrimaryFails()
    {
        var primaryModel = new ModelCatalogEntry
        {
            ModelKey = "primary",
            Provider = "openai",
            ProviderModelId = "primary-model"
        };

        var fallbackModel = new ModelCatalogEntry
        {
            ModelKey = "fallback",
            Provider = "anthropic",
            ProviderModelId = "fallback-model"
        };

        var factory = new FakeProviderClientFactory(new Dictionary<string, IModelProviderClient>
        {
            ["openai"] = new ThrowingProviderClient(),
            ["anthropic"] = new StaticProviderClient("fallback response")
        });

        var gateway = new ProviderGateway(factory, NullLogger<ProviderGateway>.Instance);

        var result = await gateway.CompleteWithFallbackAsync(
            primaryModel,
            fallbackModel,
            new ProviderChatRequest
            {
                ModelKey = "primary",
                ProviderModelId = "primary-model",
                Messages = [new ProviderChatMessage("user", "hello")],
                Attachments = [],
                Stream = false
            },
            CancellationToken.None);

        Assert.Equal("fallback response", result.ResponseText);
    }

    [Fact]
    public async Task AttachmentService_RejectsFilesLargerThanOneMb()
    {
        await using var db = CreateDb();

        var service = new AttachmentService(
            db,
            new FakeObjectStorage(),
            new FakeDocumentExtractor(),
            new FixedClock(DateTime.UtcNow));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreatePresignedUploadAsync(
                Guid.NewGuid(),
                "a.pdf",
                "application/pdf",
                sizeBytes: (1024 * 1024) + 1,
                CancellationToken.None));
    }

    [Fact]
    public async Task MemoryService_ComposesFactsAndSummaryInSystemContext()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var chatId = Guid.NewGuid();

        db.MemoryFacts.Add(new MemoryFact
        {
            UserId = userId,
            Key = "name",
            Value = "Neil",
            Confidence = 0.9m
        });

        db.ChatSummaries.Add(new ChatSummary
        {
            ChatId = chatId,
            SummaryText = "User asked about pricing plans."
        });

        await db.SaveChangesAsync();

        var memory = new MemoryService(db, new FixedClock(DateTime.UtcNow));
        var context = await memory.BuildSystemContextAsync(userId, chatId, CancellationToken.None);

        Assert.Contains("name: Neil", context);
        Assert.Contains("pricing plans", context);
    }

    private static HyokaDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<HyokaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new HyokaDbContext(options);
    }

    private sealed class FixedClock(DateTime now) : IClock
    {
        public DateTime UtcNow => now;
    }

    private sealed class FakeProviderClientFactory(Dictionary<string, IModelProviderClient> map) : IProviderClientFactory
    {
        public IModelProviderClient GetClient(string provider) => map[provider];
    }

    private sealed class ThrowingProviderClient : IModelProviderClient
    {
        public Task<ProviderChatResult> CompleteAsync(ProviderChatRequest request, CancellationToken ct)
            => throw new HttpRequestException("boom");

        public IAsyncEnumerable<ProviderStreamChunk> StreamAsync(
            ProviderChatRequest request,
            CancellationToken ct)
        {
            return Empty();

            #pragma warning disable CS1998
            static async IAsyncEnumerable<ProviderStreamChunk> Empty()
            {
                yield break;
            }
            #pragma warning restore CS1998
        }
    }

    private sealed class StaticProviderClient(string response) : IModelProviderClient
    {
        public Task<ProviderChatResult> CompleteAsync(ProviderChatRequest request, CancellationToken ct)
            => Task.FromResult(new ProviderChatResult
            {
                ResponseText = response,
                InputTokens = 10,
                OutputTokens = 10
            });

        public IAsyncEnumerable<ProviderStreamChunk> StreamAsync(ProviderChatRequest request, CancellationToken ct)
        {
            return Single();

            #pragma warning disable CS1998
            async IAsyncEnumerable<ProviderStreamChunk> Single()
            {
                yield return new ProviderStreamChunk(response);
            }
            #pragma warning restore CS1998
        }
    }

    private sealed class FakeObjectStorage : IObjectStorage
    {
        public Task<Stream?> DownloadAsync(string key, CancellationToken ct) => Task.FromResult<Stream?>(new MemoryStream());
        public Task<long?> GetSizeAsync(string key, CancellationToken ct) => Task.FromResult<long?>(0);
        public Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct) => Task.CompletedTask;
    }

    private sealed class FakeDocumentExtractor : IDocumentExtractor
    {
        public Task<string?> TryExtractTextAsync(string fileName, string mimeType, Stream content, CancellationToken ct)
            => Task.FromResult<string?>("ok");
    }
}
