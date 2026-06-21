export default async function handler(req, res) {
  // Verify it's called by Vercel Cron
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Use own domain so requests go through whitelisted IP
  const BASE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://akkkkkkkwayss.vercel.app';

  const queues = [
    'scheduler_queue_anton',
    'scheduler_queue_fano',
    'scheduler_queue_jonas',
    'scheduler_queue_grisha'
  ];

  let totalFired = 0;
  const now = Date.now();

  for (const queueKey of queues) {
    try {
      const r = await fetch(`${url}/get/${queueKey}`, { headers });
      const data = await r.json();
      if (!data.result) continue;

      let queue = data.result;
      if (typeof queue === 'string') queue = JSON.parse(queue);
      if (typeof queue === 'string') queue = JSON.parse(queue);
      if (!Array.isArray(queue) || !queue.length) continue;

      let changed = false;

      for (const item of queue) {
        if (item.status !== 'pending') continue;
        if (now < item.fireAt) continue;

        item.status = 'firing';
        try {
          const appId = item.game?.ios || item.game?.pkg;

          const eventValue = item.event?.value && Object.keys(item.event.value).length
            ? JSON.stringify(item.event.value)
            : "";

          const eventTime = new Date().toISOString()
            .replace('T', ' ').replace('Z', '').slice(0, 23);

          const payload = {
            appsflyer_id:     item.af_id,
            customer_user_id: item.device_name || '',
            eventName:        item.event.tmpl,
            eventCurrency:    "USD",
            eventValue,
            eventTime
          };

          // Route through /api/proxy so it uses the whitelisted IP
          const fireRes = await fetch(`${BASE_URL}/api/proxy?appId=${appId}`, {
            method: 'POST',
            headers: {
              'authentication': item.game.key,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          item.status = (fireRes.ok || fireRes.status === 200) ? 'done' : 'failed';
          totalFired++;
        } catch (e) {
          item.status = 'failed';
          console.error(`Fire error for ${queueKey} item ${item.id}:`, e.message);
        }
        changed = true;
      }

      if (changed) {
        await fetch(`${url}/set/${queueKey}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(JSON.stringify(queue))
        });
      }
    } catch (e) {
      console.error(`Error processing ${queueKey}:`, e.message);
    }
  }

  res.status(200).json({ ok: true, fired: totalFired, timestamp: new Date().toISOString() });
}
