namespace Hyoka.Application.Abstractions;

public interface IProviderClientFactory
{
    IModelProviderClient GetClient(string provider);
}
