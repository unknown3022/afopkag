export const config = { api: { bodyParser: true } };
 
export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
 
  if (!url || !token) {
    return res.status(500).json({ error: 'Upstash not configured' });
  }
 
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
 
  const { action } = req.query;
 
  if (action === 'get') {
    const r = await fetch(`${url}/get/scheduler_queue`, { headers });
    const data = await r.json();
    console.log('Upstash get raw:', JSON.stringify(data));
    const queue = data.result ? JSON.parse(data.result) : [];
    return res.status(200).json({ queue });
  }
 
  if (action === 'set') {
    const queue = req.body.queue;
    console.log('Saving queue length:', queue.length);
    const encoded = encodeURIComponent(JSON.stringify(queue));
    const r = await fetch(`${url}/set/scheduler_queue/${encoded}`, {
      method: 'GET',
      headers
    });
    const data = await r.json();
    console.log('Upstash set response:', JSON.stringify(data));
    return res.status(200).json({ ok: true });
  }
 
  res.status(400).json({ error: 'Unknown action' });
}
