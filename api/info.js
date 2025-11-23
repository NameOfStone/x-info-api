// api/info.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const username = (req.query.user || '').trim();
  if (!username) return res.status(400).json({ ok:false, error: 'missing_user' });

  const BEARER = process.env.TWITTER_BEARER;
  if (!BEARER) return res.status(500).json({ ok:false, error: 'server_misconfigured', message: 'TWITTER_BEARER env var not set' });

  try {
    const guestResp = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BEARER}`,
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!guestResp.ok) {
      const t = await guestResp.text().catch(()=>null);
      return res.status(502).json({ ok:false, error: 'guest_activate_failed', details: t });
    }
    const guestJson = await guestResp.json();
    const guestToken = guestJson?.guest_token;
    if (!guestToken) return res.status(502).json({ ok:false, error: 'no_guest_token', raw: guestJson });

    const userUrl = `https://api.twitter.com/1.1/users/show.json?screen_name=${encodeURIComponent(username)}`;
    const userResp = await fetch(userUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${BEARER}`,
        'x-guest-token': guestToken,
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!userResp.ok) {
      const t = await userResp.text().catch(()=>null);
      return res.status(502).json({ ok:false, error: 'user_fetch_failed', details: t });
    }
    const userJson = await userResp.json();

    const account_based_in = userJson.location || null;

    let connected_via = null;
    try {
      const srcHtml = userJson?.status?.source || '';
      connected_via = srcHtml.replace(/<[^>]*>/g, '').trim() || null;
    } catch (e) {
      connected_via = null;
    }

    return res.json({
      ok: true,
      screen_name: userJson.screen_name || username,
      name: userJson.name || null,
      account_based_in,
      connected_via,
      raw: { fetched_user: !!userJson }
    });

  } catch (err) {
    console.error('error in api/info:', err);
    return res.status(500).json({ ok:false, error: 'internal', details: String(err) });
  }
};
