using JapaneseFood.Common.Helper;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Threading.Channels;

namespace JapaneseFood.Service.Email
{
    public sealed record EmailMessage(string To, string Subject, string HtmlBody);

    /// <summary>
    /// Fire-and-forget email so checkout / registration never wait on SMTP.
    /// Messages are sent by <see cref="EmailBackgroundSender"/>; failures are logged, not thrown.
    /// </summary>
    public interface IEmailQueue
    {
        void Enqueue(EmailMessage message);
    }

    public sealed class EmailQueue : IEmailQueue
    {
        private readonly Channel<EmailMessage> _channel = Channel.CreateBounded<EmailMessage>(
            new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest });

        public ChannelReader<EmailMessage> Reader => _channel.Reader;

        public void Enqueue(EmailMessage message)
        {
            if (string.IsNullOrWhiteSpace(message.To)) return;
            _channel.Writer.TryWrite(message);
        }
    }

    public sealed class EmailBackgroundSender(EmailQueue queue, IServiceScopeFactory scopes, ILogger<EmailBackgroundSender> logger)
        : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await foreach (var message in queue.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopes.CreateScope();
                    var sender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
                    await sender.SendAsync(message.To, message.Subject, message.HtmlBody);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to send email '{Subject}' to {To}", message.Subject, message.To);
                }
            }
        }
    }
}
