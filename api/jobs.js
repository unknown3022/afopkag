const QUEUES = {
  anton: 'scheduler_queue_anton',
  fano: 'scheduler_queue_fano',
  jonas: 'scheduler_queue_jonas',
  grisha: 'scheduler_queue_grisha'
};

function queueKeyForUser(user) {
  return QUEUES[String(user || '').toLowerCase()] || null;
}

function redisHeaders() {
  return {
    Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

async function readQueue(key) {
  const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: redisHeaders()
  });
  const data = await response.json();
  let queue = data.result || [];
  if (typeof queue === 'string') queue = JSON.parse(queue);
  if (typeof queue === 'string') queue = JSON.parse(queue);
  return Array.isArray(queue) ? queue : [];
}

async function writeQueue(key, queue) {
  const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${key}`, {
    method: 'POST',
    headers: redisHeaders(),
    body: JSON.stringify(JSON.stringify(queue))
  });

  if (!response.ok) {
    throw new Error(`Redis write failed with ${response.status}`);
  }
}

export default async function handler(req, res) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Redis environment is not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const user = req.method === 'GET' ? req.query.user : body.user;
    const key = queueKeyForUser(user);
    if (!key) return res.status(400).json({ error: 'Invalid user' });

    if (req.method === 'GET') {
      const queue = await readQueue(key);
      return res.status(200).json({ queue });
    }

    if (req.method === 'PUT') {
      const queue = Array.isArray(body.queue) ? body.queue : null;
      if (!queue) return res.status(400).json({ error: 'Queue must be an array' });
      await writeQueue(key, queue);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
