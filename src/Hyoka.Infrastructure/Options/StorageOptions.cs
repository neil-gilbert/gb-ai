namespace Hyoka.Infrastructure.Options;

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    public string ServiceUrl { get; set; } = "http://localhost:9000";
    public string AccessKey { get; set; } = "minio";
    public string SecretKey { get; set; } = "minio123";
    public string Bucket { get; set; } = "hyoka-attachments";
    public bool UsePathStyle { get; set; } = true;
}
