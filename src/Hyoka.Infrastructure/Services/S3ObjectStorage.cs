using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using Hyoka.Application.Abstractions;
using Hyoka.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace Hyoka.Infrastructure.Services;

public sealed class S3ObjectStorage : IObjectStorage
{
    private readonly StorageOptions _options;
    private readonly AmazonS3Client _client;

    public S3ObjectStorage(IOptions<StorageOptions> options)
    {
        _options = options.Value;
        var config = new AmazonS3Config
        {
            ServiceURL = _options.ServiceUrl,
            ForcePathStyle = _options.UsePathStyle,
            SignatureVersion = "4",
            AuthenticationRegion = "us-east-1",
            RegionEndpoint = RegionEndpoint.USEast1
        };

        var credentials = new BasicAWSCredentials(_options.AccessKey, _options.SecretKey);
        _client = new AmazonS3Client(credentials, config);
    }

    public async Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct)
    {
        await EnsureBucketExistsAsync(ct);

        var request = new PutObjectRequest
        {
            BucketName = _options.Bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            AutoCloseStream = false
        };

        await _client.PutObjectAsync(request, ct);
    }

    public async Task<Stream?> DownloadAsync(string key, CancellationToken ct)
    {
        try
        {
            var response = await _client.GetObjectAsync(_options.Bucket, key, ct);
            return response.ResponseStream;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<long?> GetSizeAsync(string key, CancellationToken ct)
    {
        try
        {
            var metadata = await _client.GetObjectMetadataAsync(_options.Bucket, key, ct);
            return metadata.ContentLength;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    private async Task EnsureBucketExistsAsync(CancellationToken ct)
    {
        var exists = await AmazonS3Util.DoesS3BucketExistV2Async(_client, _options.Bucket);
        if (exists)
        {
            return;
        }

        await _client.PutBucketAsync(_options.Bucket, ct);
    }
}
