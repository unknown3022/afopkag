export default async function handler(req, res) {
  // Verify it's called by Vercel Cron
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const queues = [
    'scheduler_queue_anton',
    'scheduler_queue_fano',
    'scheduler_queue_jonas',
    'scheduler_queue_grisha'   // ← added
  ];

  let totalFired = 0;
  const now = Date.now();

  for (const queueKey of queues) {
    try {
      // Load queue
      const r = await fetch(`${url}/get/${queueKey}`, { headers });
      const data = await r.json();
      if (!data.result) continue;

      let queue = data.result;
      if (typeof queue === 'string') queue = JSON.parse(queue);
      if (typeof queue === 'string') queue = JSON.parse(queue); // double-encoded guard
      if (!Array.isArray(queue) || !queue.length) continue;

      let changed = false;

      for (const item of queue) {
        if (item.status !== 'pending') continue;
        if (now < item.fireAt) continue;

        item.status = 'firing';
        try {
          // Fix: use pkg as fallback, NOT af_id
          const appId = item.game?.ios || item.game?.pkg;

          const eventValue = item.event?.value && Object.keys(item.event.value).length
            ? JSON.stringify(item.event.value)
            : "";  // Fix: empty object → empty string

          const eventTime = new Date().toISOString()
            .replace('T', ' ').replace('Z', '').slice(0, 23);

          const payload = {
            appsflyer_id:      item.af_id,
            customer_user_id:  item.device_name || '',
            eventName:         item.event.tmpl,
            eventCurrency:     "USD",
            eventValue,
            eventTime          // Fix: required by AppsFlyer
          };

          const fireRes = await fetch(`https://api2.appsflyer.com/inappevent/${appId}`, {
            method: 'POST',
            headers: {
              'authentication':  item.game.key,
              'Content-Type':    'application/json'
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

      // Save back if anything changed
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
