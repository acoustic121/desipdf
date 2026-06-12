const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
  'https://inv.in.projectsegfau.lt',
  'https://invidious.asir.dev',
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.privacydev.net',
  'https://inv.tux.pizza',
  'https://invidious.no-logs.com',
  'https://inv.vern.cc',
  'https://invidious.io.lol',
  'https://invidious.flokinet.to',
  'https://invidious.projectsegfau.lt',
  'https://invidious.slipfox.xyz',
  'https://inv.us.projectsegfau.lt',
  'https://invidious.lunar.icu'
];

async function test(videoId) {
  let instances = [...INVIDIOUS_INSTANCES];
  try {
    const listResp = await fetch('https://api.invidious.io/instances.json');
    if (listResp.ok) {
      const listData = await listResp.json();
      if (Array.isArray(listData)) {
        const dynamicInstances = listData
          .filter(item => {
            const stats = item[1];
            return stats && stats.api && stats.type === 'https' && stats.uri;
          })
          .map(item => item[1].uri);
        if (dynamicInstances.length > 0) {
          instances = [...new Set([...dynamicInstances, ...instances])];
        }
      }
    }
  } catch (e) {
    console.log('Instances fetch failed, using fallbacks:', e.message);
  }

  instances.sort(() => Math.random() - 0.5);
  const candidates = instances.slice(0, 12);
  console.log(`Querying ${candidates.length} instances in parallel for ${videoId}...`);

  const fetchPromise = (instance) => {
    return new Promise(async (resolve, reject) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const resp = await fetch(
          `${instance}/api/v1/videos/${videoId}?fields=title,videoThumbnails,formatStreams,adaptiveFormats`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);

        if (!resp.ok) {
          reject(new Error(`HTTP ${resp.status}`));
          return;
        }

        const data = await resp.json();
        console.log(`Success via ${instance}: "${data.title}"`);
        resolve(data);
      } catch (e) {
        reject(e);
      }
    });
  };

  try {
    const result = await Promise.any(candidates.map(fetchPromise));
    console.log('Test completed successfully!');
  } catch (err) {
    console.error('All instances failed:', err.errors);
  }
}

test('dQw4w9WgXcQ');
