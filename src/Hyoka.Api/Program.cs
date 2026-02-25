using System.Security.Claims;
using System.Text.Json;
using Hyoka.Api.Contracts;
using Hyoka.Api.Extensions;
using Hyoka.Api.Middleware;
using Hyoka.Api.Security;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Domain.Entities;
using Hyoka.Domain.Enums;
using Hyoka.Domain.Helpers;
using Hyoka.Infrastructure.Data;
using Hyoka.Infrastructure.Extensions;
using Hyoka.Infrastructure.Options;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHyokaInfrastructure(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

var clerkOptions = builder.Configuration.GetSection(ClerkOptions.SectionName).Get<ClerkOptions>() ?? new ClerkOptions();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = "smart";
        options.DefaultChallengeScheme = "smart";
    })
    .AddPolicyScheme("smart", "JWT or dev auth", options =>
    {
        options.ForwardDefaultSelector = context =>
            context.Request.Headers.ContainsKey("Authorization")
                ? JwtBearerDefaults.AuthenticationScheme
                : "dev";
    })
    .AddJwtBearer(options =>
    {
        if (!string.IsNullOrWhiteSpace(clerkOptions.Issuer))
        {
            options.Authority = clerkOptions.Issuer;
            options.TokenValidationParameters.ValidateIssuer = true;
        }

        if (!string.IsNullOrWhiteSpace(clerkOptions.Audience))
        {
            options.Audience = clerkOptions.Audience;
            options.TokenValidationParameters.ValidateAudience = true;
        }
        else
        {
            options.TokenValidationParameters.ValidateAudience = false;
        }

        options.TokenValidationParameters.NameClaimType = "sub";
        options.TokenValidationParameters.RoleClaimType = "role";
    })
    .AddScheme<AuthenticationSchemeOptions, DevAuthHandler>("dev", _ => { });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminPolicy", policy =>
    {
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim(ClaimTypes.Role, UserRole.Admin)
            || ctx.User.HasClaim("role", UserRole.Admin));
    });
});

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseMiddleware<UserProvisioningMiddleware>();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HyokaDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    var shouldSeed = !app.Environment.IsProduction() || builder.Configuration.GetValue<bool>("Database:SeedOnStartup");

    if (shouldSeed)
    {
        try
        {
            await DbSeeder.SeedAsync(db);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Database seed failed during startup.");

            if (!app.Environment.IsProduction())
            {
                throw;
            }
        }
    }
}

app.MapGet("/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));

var api = app.MapGroup("/api/v1").RequireAuthorization();

api.MapGet("/auth/me", async (
    HttpContext httpContext,
    HyokaDbContext db,
    IPlanService planService,
    IUsageService usageService,
    CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);
    var plan = await planService.GetActivePlanAsync(user.Id, ct);
    var usageContext = await planService.GetUsageContextAsync(user.Id, ct);
    var usage = await usageService.GetSnapshotAsync(user.Id, usageContext, ct);

    return Results.Ok(new
    {
        user = new
        {
            user.Id,
            user.Email,
            user.Role,
            user.TimezoneMetadata,
            user.CreatedAtUtc
        },
        plan = new
        {
            plan.Name,
            plan.MonthlyPriceUsd,
            limits = new
            {
                plan.RequestsPerMinute,
                plan.RequestsPerDay,
                plan.RequestsPerMonth,
                plan.CreditsPerDay,
                plan.CreditsPerMonth
            }
        },
        usage
    });
});

api.MapGet("/models", async (HttpContext httpContext, HyokaDbContext db, IPlanService planService, CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);
    var context = await planService.GetUsageContextAsync(user.Id, ct);

    var models = await db.ModelCatalog
        .Where(x => x.Enabled)
        .ToListAsync(ct);

    var allowed = models
        .Where(m => m.GetPlanAccess().Contains(context.PlanName, StringComparer.OrdinalIgnoreCase))
        .Select(m => new
        {
            m.ModelKey,
            m.DisplayName,
            m.Provider,
            m.InputWeight,
            m.OutputWeight
        })
        .OrderBy(x => x.DisplayName)
        .ToList();

    return Results.Ok(allowed);
});

api.MapPost("/chats", async (CreateChatRequest request, HttpContext httpContext, HyokaDbContext db, CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    var chat = new Chat
    {
        UserId = user.Id,
        Title = string.IsNullOrWhiteSpace(request.Title) ? "New chat" : request.Title.Trim(),
        CreatedAtUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow
    };

    db.Chats.Add(chat);
    await db.SaveChangesAsync(ct);

    return Results.Ok(new
    {
        chat.Id,
        chat.Title,
        chat.CreatedAtUtc,
        chat.UpdatedAtUtc
    });
});

api.MapGet("/chats", async (
    string? search,
    string? cursor,
    HttpContext httpContext,
    HyokaDbContext db,
    CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    var query = db.Chats
        .Where(x => x.UserId == user.Id && x.ArchivedAtUtc == null)
        .OrderByDescending(x => x.UpdatedAtUtc)
        .AsQueryable();

    if (!string.IsNullOrWhiteSpace(search))
    {
        var lowered = search.Trim().ToLowerInvariant();
        query = query.Where(x => x.Title.ToLower().Contains(lowered));
    }

    if (!string.IsNullOrWhiteSpace(cursor) && long.TryParse(cursor, out var ticks))
    {
        var cursorTime = new DateTime(ticks, DateTimeKind.Utc);
        query = query.Where(x => x.UpdatedAtUtc < cursorTime);
    }

    var chats = await query.Take(30).ToListAsync(ct);

    var chatIds = chats.Select(c => c.Id).ToList();
    var firstMessages = await db.Messages
        .Where(m => chatIds.Contains(m.ChatId) && m.Role == MessageRole.User)
        .OrderBy(m => m.CreatedAtUtc)
        .GroupBy(m => m.ChatId)
        .Select(g => new { ChatId = g.Key, Text = g.Select(x => x.DisplayText).FirstOrDefault() })
        .ToListAsync(ct);

    var previewMap = firstMessages.ToDictionary(x => x.ChatId, x => x.Text ?? string.Empty);

    var nextCursor = chats.Count == 30
        ? chats[^1].UpdatedAtUtc.Ticks.ToString()
        : null;

    var result = chats.Select(c => new
    {
        c.Id,
        c.Title,
        Preview = previewMap.TryGetValue(c.Id, out var preview)
            ? ChatTitleHelper.FromFirstPrompt(preview)
            : c.Title,
        c.CreatedAtUtc,
        c.UpdatedAtUtc
    });

    return Results.Ok(new
    {
        items = result,
        nextCursor
    });
});

api.MapGet("/chats/{chatId:guid}/messages", async (
    Guid chatId,
    string? cursor,
    HttpContext httpContext,
    HyokaDbContext db,
    CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    var hasChat = await db.Chats.AnyAsync(x => x.Id == chatId && x.UserId == user.Id, ct);
    if (!hasChat)
    {
        return Results.NotFound(new { error = "Chat not found." });
    }

    var query = db.Messages
        .Where(x => x.ChatId == chatId)
        .OrderByDescending(x => x.CreatedAtUtc)
        .AsQueryable();

    if (!string.IsNullOrWhiteSpace(cursor) && long.TryParse(cursor, out var ticks))
    {
        var cursorTime = new DateTime(ticks, DateTimeKind.Utc);
        query = query.Where(x => x.CreatedAtUtc < cursorTime);
    }

    var page = await query.Take(80).ToListAsync(ct);
    page.Reverse();

    var nextCursor = page.Count == 80
        ? page[0].CreatedAtUtc.Ticks.ToString()
        : null;

    return Results.Ok(new
    {
        items = page.Select(x => new
        {
            x.Id,
            x.Role,
            x.DisplayText,
            x.ModelKey,
            x.InputTokens,
            x.OutputTokens,
            x.CreatedAtUtc
        }),
        nextCursor
    });
});

api.MapPost("/chats/{chatId:guid}/messages/stream", async (
    Guid chatId,
    SendMessageRequest request,
    HttpContext httpContext,
    HyokaDbContext db,
    IPlanService planService,
    IUsageService usageService,
    IMemoryService memoryService,
    IAttachmentService attachmentService,
    IProviderGateway providerGateway,
    IRpmLimiter rpmLimiter,
    ILoggerFactory loggerFactory,
    CancellationToken ct) =>
{
    var logger = loggerFactory.CreateLogger("ChatStream");
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    if (string.IsNullOrWhiteSpace(request.Text))
    {
        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        await httpContext.Response.WriteAsJsonAsync(new { error = "Message text cannot be empty." }, ct);
        return;
    }

    var chat = await db.Chats
        .FirstOrDefaultAsync(x => x.Id == chatId && x.UserId == user.Id, ct);

    if (chat is null)
    {
        httpContext.Response.StatusCode = StatusCodes.Status404NotFound;
        await httpContext.Response.WriteAsJsonAsync(new { error = "Chat not found." }, ct);
        return;
    }

    var planContext = await planService.GetUsageContextAsync(user.Id, ct);
    if (!rpmLimiter.TryConsume(user.Id, planContext.RequestsPerMinute))
    {
        httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await httpContext.Response.WriteAsJsonAsync(new { error = "Rate limit exceeded for your plan." }, ct);
        return;
    }

    var quota = await usageService.EvaluateBeforeRequestAsync(user.Id, planContext, ct);
    if (!quota.Allowed)
    {
        httpContext.Response.StatusCode = StatusCodes.Status402PaymentRequired;
        await httpContext.Response.WriteAsJsonAsync(new { error = quota.Reason }, ct);
        return;
    }

    var model = await db.ModelCatalog.FirstOrDefaultAsync(x => x.ModelKey == request.ModelKey && x.Enabled, ct);
    if (model is null)
    {
        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        await httpContext.Response.WriteAsJsonAsync(new { error = "Model not found or disabled." }, ct);
        return;
    }

    if (!model.GetPlanAccess().Contains(planContext.PlanName, StringComparer.OrdinalIgnoreCase))
    {
        httpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
        await httpContext.Response.WriteAsJsonAsync(new { error = "Model is not available on your current plan." }, ct);
        return;
    }

    var fallbackModel = !string.IsNullOrWhiteSpace(model.FallbackModelKey)
        ? await db.ModelCatalog.FirstOrDefaultAsync(x => x.ModelKey == model.FallbackModelKey && x.Enabled, ct)
        : null;

    IReadOnlyList<Attachment> attachments;
    try
    {
        attachments = await attachmentService.ResolveAttachmentsAsync(user.Id, request.AttachmentIds, ct);
    }
    catch (Exception ex)
    {
        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        await httpContext.Response.WriteAsJsonAsync(new { error = ex.Message }, ct);
        return;
    }

    var firstUserMessageExists = await db.Messages.AnyAsync(
        x => x.ChatId == chat.Id && x.Role == MessageRole.User,
        ct);

    var userMessage = new Message
    {
        ChatId = chat.Id,
        Role = MessageRole.User,
        DisplayText = request.Text.Trim(),
        ModelKey = model.ModelKey,
        CreatedAtUtc = DateTime.UtcNow
    };

    db.Messages.Add(userMessage);

    if (!firstUserMessageExists)
    {
        chat.Title = ChatTitleHelper.FromFirstPrompt(request.Text);
    }

    chat.UpdatedAtUtc = DateTime.UtcNow;
    await db.SaveChangesAsync(ct);

    await memoryService.ExtractAndUpsertFactsAsync(user.Id, request.Text, ct);

    var history = await db.Messages
        .Where(x => x.ChatId == chat.Id)
        .OrderBy(x => x.CreatedAtUtc)
        .ToListAsync(ct);

    if (history.Count > 30)
    {
        history = history[^30..];
    }

    var systemPrompt = await memoryService.BuildSystemContextAsync(user.Id, chat.Id, ct);

    var providerRequest = new ProviderChatRequest
    {
        ModelKey = model.ModelKey,
        ProviderModelId = model.ProviderModelId ?? model.ModelKey,
        Messages = history.Select(x => new ProviderChatMessage(x.Role, x.DisplayText)).ToList(),
        Attachments = attachments.Select(x => new ProviderAttachment(x.MimeType, x.OriginalFileName, x.StorageKey, x.ExtractedText)).ToList(),
        SystemPrompt = systemPrompt,
        Stream = true
    };

    httpContext.Response.StatusCode = StatusCodes.Status200OK;
    httpContext.Response.Headers.ContentType = "text/event-stream";
    httpContext.Response.Headers.CacheControl = "no-cache";
    httpContext.Response.Headers.Connection = "keep-alive";

    try
    {
        var providerResult = await providerGateway.CompleteWithFallbackAsync(model, fallbackModel, providerRequest, ct);

        var assistantMessage = new Message
        {
            ChatId = chat.Id,
            Role = MessageRole.Assistant,
            DisplayText = providerResult.ResponseText,
            ModelKey = model.ModelKey,
            InputTokens = providerResult.InputTokens,
            OutputTokens = providerResult.OutputTokens,
            RawPayloadJson = providerResult.RawPayloadJson,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.Messages.Add(assistantMessage);
        chat.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        foreach (var delta in StreamDelta(providerResult.ResponseText))
        {
            await WriteSseAsync(httpContext, new
            {
                type = "assistant.delta",
                text = delta
            }, ct);
            await Task.Delay(12, ct);
        }

        var credits = await usageService.RecordUsageAsync(new UsageRecordRequest
        {
            UserId = user.Id,
            ModelKey = model.ModelKey,
            SourceMessageId = assistantMessage.Id,
            InputTokens = providerResult.InputTokens,
            OutputTokens = providerResult.OutputTokens,
            InputWeight = model.InputWeight,
            OutputWeight = model.OutputWeight,
            MonthCycleKey = planContext.MonthCycleKey
        }, ct);

        await memoryService.UpsertConversationSummaryAsync(chat.Id, BuildSummaryText(history, providerResult.ResponseText), ct);

        await WriteSseAsync(httpContext, new
        {
            type = "assistant.completed",
            messageId = assistantMessage.Id,
            inputTokens = providerResult.InputTokens,
            outputTokens = providerResult.OutputTokens,
            creditsUsed = credits
        }, ct);

        var usageSnapshot = await usageService.GetSnapshotAsync(user.Id, planContext, ct);

        await WriteSseAsync(httpContext, new
        {
            type = "usage.updated",
            dailyUsed = usageSnapshot.DailyCreditsUsed,
            monthlyUsed = usageSnapshot.MonthlyCreditsUsed
        }, ct);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Streaming failed for chat {ChatId}", chatId);
        await WriteSseAsync(httpContext, new
        {
            type = "error",
            code = "provider_error",
            message = ex.Message
        }, ct);
    }
});

api.MapPost("/attachments/presign", async (
    PresignAttachmentRequest request,
    HttpContext httpContext,
    HyokaDbContext db,
    IAttachmentService attachmentService,
    CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    try
    {
        var attachment = await attachmentService.CreatePresignedUploadAsync(
            user.Id,
            request.FileName,
            request.MimeType,
            request.SizeBytes,
            ct);

        return Results.Ok(new
        {
            attachmentId = attachment.Id,
            uploadUrl = $"/api/v1/attachments/{attachment.Id}/upload",
            attachment.Status
        });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

api.MapPut("/attachments/{attachmentId:guid}/upload", async (
    Guid attachmentId,
    HttpContext httpContext,
    HyokaDbContext db,
    IAttachmentService attachmentService,
    CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    if (!httpContext.Request.HasFormContentType)
    {
        return Results.BadRequest(new { error = "Expected multipart/form-data upload." });
    }

    var form = await httpContext.Request.ReadFormAsync(ct);
    var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();

    if (file is null)
    {
        return Results.BadRequest(new { error = "No file part was provided." });
    }

    await using var stream = file.OpenReadStream();
    await attachmentService.UploadAsync(user.Id, attachmentId, stream, file.ContentType, ct);

    return Results.Ok(new { status = "uploaded" });
});

api.MapPost("/attachments/{attachmentId:guid}/finalize", async (
    Guid attachmentId,
    HttpContext httpContext,
    HyokaDbContext db,
    IAttachmentService attachmentService,
    CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    try
    {
        var attachment = await attachmentService.FinalizeAsync(user.Id, attachmentId, ct);
        return Results.Ok(new
        {
            attachment.Id,
            attachment.Status,
            attachment.MimeType,
            attachment.SizeBytes,
            attachment.OriginalFileName
        });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

api.MapGet("/usage", async (HttpContext httpContext, HyokaDbContext db, IPlanService planService, IUsageService usageService, CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);
    var plan = await planService.GetActivePlanAsync(user.Id, ct);
    var usageContext = await planService.GetUsageContextAsync(user.Id, ct);
    var snapshot = await usageService.GetSnapshotAsync(user.Id, usageContext, ct);

    return Results.Ok(new
    {
        plan = plan.Name,
        snapshot
    });
});

api.MapPost("/billing/checkout", async (
    CheckoutRequest request,
    HttpContext httpContext,
    HyokaDbContext db,
    IBillingService billingService,
    IConfiguration config,
    CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    var success = request.SuccessUrl ?? config["Stripe:SuccessUrl"];
    var cancel = request.CancelUrl ?? config["Stripe:CancelUrl"];

    var url = await billingService.CreateCheckoutSessionAsync(user.Id, request.PlanName, success ?? string.Empty, cancel ?? string.Empty, ct);
    return Results.Ok(new { url });
});

api.MapPost("/billing/portal", async (
    PortalRequest request,
    HttpContext httpContext,
    HyokaDbContext db,
    IBillingService billingService,
    IConfiguration config,
    CancellationToken ct) =>
{
    var user = await httpContext.RequireCurrentUserAsync(db, ct);

    var returnUrl = request.ReturnUrl ?? config["Stripe:SuccessUrl"];
    var url = await billingService.CreatePortalSessionAsync(user.Id, returnUrl ?? string.Empty, ct);
    return Results.Ok(new { url });
});

app.MapPost("/api/v1/webhooks/stripe", async (
    HttpContext httpContext,
    IBillingService billingService,
    CancellationToken ct) =>
{
    using var reader = new StreamReader(httpContext.Request.Body);
    var payload = await reader.ReadToEndAsync(ct);
    var signature = httpContext.Request.Headers["Stripe-Signature"].FirstOrDefault() ?? string.Empty;

    await billingService.HandleWebhookAsync(payload, signature, ct);
    return Results.Ok(new { ok = true });
}).AllowAnonymous();

var admin = app.MapGroup("/api/v1/admin")
    .RequireAuthorization("AdminPolicy");

admin.MapGet("/users", async (
    string? search,
    int take,
    HyokaDbContext db,
    CancellationToken ct) =>
{
    if (take <= 0 || take > 200)
    {
        take = 50;
    }

    var query = db.Users.AsQueryable();
    if (!string.IsNullOrWhiteSpace(search))
    {
        var term = search.Trim().ToLowerInvariant();
        query = query.Where(x => x.Email.ToLower().Contains(term) || x.ClerkUserId.ToLower().Contains(term));
    }

    var users = await query
        .OrderByDescending(x => x.CreatedAtUtc)
        .Take(take)
        .ToListAsync(ct);

    var ids = users.Select(x => x.Id).ToList();
    var subs = await db.Subscriptions
        .Include(x => x.Plan)
        .Where(x => ids.Contains(x.UserId))
        .OrderByDescending(x => x.CreatedAtUtc)
        .ToListAsync(ct);

    return Results.Ok(users.Select(u =>
    {
        var latestSub = subs.FirstOrDefault(x => x.UserId == u.Id);
        return new
        {
            u.Id,
            u.Email,
            u.Role,
            u.CreatedAtUtc,
            plan = latestSub?.Plan?.Name ?? "Free",
            subscriptionStatus = latestSub?.Status ?? "none"
        };
    }));
});

admin.MapGet("/plans", async (HyokaDbContext db, CancellationToken ct) =>
{
    var plans = await db.Plans.OrderBy(x => x.MonthlyPriceUsd).ToListAsync(ct);
    return Results.Ok(plans);
});

admin.MapPut("/plans/{planId:guid}", async (
    Guid planId,
    UpdatePlanRequest request,
    HttpContext httpContext,
    HyokaDbContext db,
    CancellationToken ct) =>
{
    var actor = await httpContext.RequireCurrentUserAsync(db, ct);
    var plan = await db.Plans.FirstOrDefaultAsync(x => x.Id == planId, ct);
    if (plan is null)
    {
        return Results.NotFound(new { error = "Plan not found." });
    }

    var before = JsonSerializer.Serialize(plan);

    plan.Name = request.Name;
    plan.StripePriceId = request.StripePriceId;
    plan.IsActive = request.IsActive;
    plan.RequestsPerMinute = request.RequestsPerMinute;
    plan.RequestsPerDay = request.RequestsPerDay;
    plan.RequestsPerMonth = request.RequestsPerMonth;
    plan.CreditsPerDay = request.CreditsPerDay;
    plan.CreditsPerMonth = request.CreditsPerMonth;
    plan.MonthlyPriceUsd = request.MonthlyPriceUsd;

    db.AdminAuditLogs.Add(new AdminAuditLog
    {
        ActorUserId = actor.Id,
        Action = "plan.update",
        TargetType = "plan",
        TargetId = plan.Id.ToString(),
        BeforeJson = before,
        AfterJson = JsonSerializer.Serialize(plan),
        CreatedAtUtc = DateTime.UtcNow
    });

    await db.SaveChangesAsync(ct);
    return Results.Ok(plan);
});

admin.MapGet("/models", async (HyokaDbContext db, CancellationToken ct) =>
{
    var models = await db.ModelCatalog.OrderBy(x => x.DisplayName).ToListAsync(ct);
    return Results.Ok(models);
});

admin.MapPut("/models/{modelId:guid}", async (
    Guid modelId,
    UpdateModelRequest request,
    HttpContext httpContext,
    HyokaDbContext db,
    CancellationToken ct) =>
{
    var actor = await httpContext.RequireCurrentUserAsync(db, ct);
    var model = await db.ModelCatalog.FirstOrDefaultAsync(x => x.Id == modelId, ct);
    if (model is null)
    {
        return Results.NotFound(new { error = "Model not found." });
    }

    var before = JsonSerializer.Serialize(model);

    model.DisplayName = request.DisplayName;
    model.Provider = request.Provider;
    model.ProviderModelId = request.ProviderModelId;
    model.FallbackModelKey = request.FallbackModelKey;
    model.InputWeight = request.InputWeight;
    model.OutputWeight = request.OutputWeight;
    model.Enabled = request.Enabled;
    model.PlanAccessCsv = request.PlanAccessCsv;

    db.AdminAuditLogs.Add(new AdminAuditLog
    {
        ActorUserId = actor.Id,
        Action = "model.update",
        TargetType = "model",
        TargetId = model.Id.ToString(),
        BeforeJson = before,
        AfterJson = JsonSerializer.Serialize(model),
        CreatedAtUtc = DateTime.UtcNow
    });

    await db.SaveChangesAsync(ct);
    return Results.Ok(model);
});

admin.MapGet("/usage", async (HyokaDbContext db, CancellationToken ct) =>
{
    var daily = await db.DailyCounters
        .GroupBy(_ => 1)
        .Select(g => new
        {
            totalRequests = g.Sum(x => x.RequestCount),
            totalCredits = g.Sum(x => x.CreditsUsed)
        })
        .FirstOrDefaultAsync(ct);

    var monthly = await db.MonthlyCounters
        .GroupBy(_ => 1)
        .Select(g => new
        {
            totalRequests = g.Sum(x => x.RequestCount),
            totalCredits = g.Sum(x => x.CreditsUsed)
        })
        .FirstOrDefaultAsync(ct);

    var topModels = await db.UsageLedger
        .GroupBy(x => x.ModelKey)
        .Select(g => new
        {
            model = g.Key,
            requests = g.Sum(x => x.RequestCount),
            credits = g.Sum(x => x.CreditsUsed)
        })
        .OrderByDescending(x => x.requests)
        .Take(10)
        .ToListAsync(ct);

    return Results.Ok(new
    {
        daily,
        monthly,
        topModels
    });
});

app.Run();

static async Task WriteSseAsync(HttpContext context, object payload, CancellationToken ct)
{
    var data = JsonSerializer.Serialize(payload);
    await context.Response.WriteAsync($"data: {data}\n\n", ct);
    await context.Response.Body.FlushAsync(ct);
}

static IEnumerable<string> StreamDelta(string response)
{
    if (string.IsNullOrWhiteSpace(response))
    {
        yield break;
    }

    const int chunkSize = 20;
    for (var i = 0; i < response.Length; i += chunkSize)
    {
        var size = Math.Min(chunkSize, response.Length - i);
        yield return response.Substring(i, size);
    }
}

static string BuildSummaryText(IReadOnlyList<Message> history, string assistantText)
{
    var lines = history
        .TakeLast(12)
        .Select(x => $"{x.Role}: {x.DisplayText}")
        .ToList();

    lines.Add($"assistant: {assistantText}");
    return string.Join("\n", lines);
}

public partial class Program { }
