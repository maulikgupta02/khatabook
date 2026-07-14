-- Meta's Cloud API delivery-status callbacks report more granularity ('delivered', 'read')
-- than the outbound-only 'queued'/'sent'/'failed' states whatsapp_log started with.
alter type whatsapp_status add value if not exists 'delivered';
alter type whatsapp_status add value if not exists 'read';
