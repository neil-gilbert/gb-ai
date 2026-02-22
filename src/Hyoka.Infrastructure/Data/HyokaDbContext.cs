using Hyoka.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Infrastructure.Data;

public sealed class HyokaDbContext(DbContextOptions<HyokaDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<ModelCatalogEntry> ModelCatalog => Set<ModelCatalogEntry>();
    public DbSet<Chat> Chats => Set<Chat>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<UsageLedgerEntry> UsageLedger => Set<UsageLedgerEntry>();
    public DbSet<DailyCounter> DailyCounters => Set<DailyCounter>();
    public DbSet<MonthlyCounter> MonthlyCounters => Set<MonthlyCounter>();
    public DbSet<MemoryFact> MemoryFacts => Set<MemoryFact>();
    public DbSet<ChatSummary> ChatSummaries => Set<ChatSummary>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(b =>
        {
            b.HasIndex(x => x.ClerkUserId).IsUnique();
            b.HasIndex(x => x.Email);
            b.Property(x => x.Role).HasMaxLength(32);
        });

        modelBuilder.Entity<Plan>(b =>
        {
            b.HasIndex(x => x.Name).IsUnique();
            b.Property(x => x.CreditsPerDay).HasPrecision(18, 2);
            b.Property(x => x.CreditsPerMonth).HasPrecision(18, 2);
            b.Property(x => x.MonthlyPriceUsd).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Subscription>(b =>
        {
            b.HasIndex(x => x.StripeSubscriptionId).IsUnique();
            b.HasIndex(x => x.UserId);
            b.HasOne(x => x.User).WithMany(x => x.Subscriptions).HasForeignKey(x => x.UserId);
            b.HasOne(x => x.Plan).WithMany(x => x.Subscriptions).HasForeignKey(x => x.PlanId);
        });

        modelBuilder.Entity<ModelCatalogEntry>(b =>
        {
            b.HasIndex(x => x.ModelKey).IsUnique();
            b.Property(x => x.InputWeight).HasPrecision(18, 4);
            b.Property(x => x.OutputWeight).HasPrecision(18, 4);
        });

        modelBuilder.Entity<Chat>(b =>
        {
            b.HasIndex(x => new { x.UserId, x.CreatedAtUtc });
            b.HasOne(x => x.User).WithMany(x => x.Chats).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<Message>(b =>
        {
            b.HasIndex(x => new { x.ChatId, x.CreatedAtUtc });
            b.HasOne(x => x.Chat).WithMany(x => x.Messages).HasForeignKey(x => x.ChatId);
        });

        modelBuilder.Entity<Attachment>(b =>
        {
            b.HasIndex(x => x.UserId);
            b.HasIndex(x => x.ChatId);
            b.HasOne(x => x.User).WithMany(x => x.Attachments).HasForeignKey(x => x.UserId);
            b.HasOne(x => x.Chat).WithMany(x => x.Attachments).HasForeignKey(x => x.ChatId);
        });

        modelBuilder.Entity<UsageLedgerEntry>(b =>
        {
            b.Property(x => x.CreditsUsed).HasPrecision(18, 4);
            b.HasIndex(x => new { x.UserId, x.DayUtc });
            b.HasIndex(x => new { x.UserId, x.MonthCycleKey });
        });

        modelBuilder.Entity<DailyCounter>(b =>
        {
            b.HasIndex(x => new { x.UserId, x.DayUtc }).IsUnique();
            b.Property(x => x.CreditsUsed).HasPrecision(18, 4);
        });

        modelBuilder.Entity<MonthlyCounter>(b =>
        {
            b.HasIndex(x => new { x.UserId, x.CycleKey }).IsUnique();
            b.Property(x => x.CreditsUsed).HasPrecision(18, 4);
        });

        modelBuilder.Entity<MemoryFact>(b =>
        {
            b.HasIndex(x => new { x.UserId, x.Key }).IsUnique();
            b.Property(x => x.Confidence).HasPrecision(5, 2);
            b.HasOne(x => x.User).WithMany(x => x.MemoryFacts).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<ChatSummary>(b =>
        {
            b.HasIndex(x => x.ChatId).IsUnique();
            b.HasOne(x => x.Chat).WithOne().HasForeignKey<ChatSummary>(x => x.ChatId);
        });

        modelBuilder.Entity<AdminAuditLog>(b =>
        {
            b.HasIndex(x => x.CreatedAtUtc);
        });
    }
}
