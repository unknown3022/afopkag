export const config = { api: { bodyParser: true } };
 
export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
 
  if (!url || !token) {
    return res.status(500).json({ error: 'Upstash not configured', url: !!url, token: !!token });
  }
 
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
 
  const { action } = req.query;
 
  if (action === 'get') {
    const r = await fetch(`${url}/get/scheduler_queue`, { headers });
    const data = await r.json();
    const queue = data.result ? JSON.parse(data.result) : [];
    return res.status(200).json({ queue });
  }
 
  if (action === 'set') {
    const queue = req.body.queue;
    await fetch(`${url}/set/scheduler_queue`, {
      method: 'POST',
      headers,
      body: JSON.stringify(JSON.stringify(queue))
    });
    return res.status(200).json({ ok: true });
  }
 
  res.status(400).json({ error: 'Unknown action' });
}
 
