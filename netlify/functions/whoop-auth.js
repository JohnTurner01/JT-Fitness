exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { code, client_id, client_secret, redirect_uri } = JSON.parse(event.body);

    if (!code || !client_id || !client_secret || !redirect_uri) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Exchange the code for tokens with WHOOP
    const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id,
        client_secret,
        redirect_uri
      }).toString()
    });

    const tokenText = await tokenRes.text();
    console.log('WHOOP token response status:', tokenRes.status, 'body:', tokenText.substring(0, 300));

    let tokens;
    try { tokens = JSON.parse(tokenText); } catch(e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token exchange failed', details: tokenText.substring(0, 200) })
      };
    }

    if (!tokenRes.ok || !tokens.access_token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token exchange failed', details: tokens })
      };
    }

    // Fetch WHOOP data using the access token
    const [recoveryRes, sleepRes, cycleRes] = await Promise.all([
      fetch('https://api.prod.whoop.com/developer/v1/recovery?limit=90', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      }),
      fetch('https://api.prod.whoop.com/developer/v1/sleep?limit=90', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      }),
      fetch('https://api.prod.whoop.com/developer/v1/cycle?limit=90', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      })
    ]);

    const safeJson = async (res) => {
      const text = await res.text();
      console.log('WHOOP data response', res.url, res.status, text.substring(0, 100));
      try { return JSON.parse(text); } catch(e) { return {}; }
    };

    const [recovery, sleep, cycles] = await Promise.all([
      safeJson(recoveryRes),
      safeJson(sleepRes),
      safeJson(cycleRes)
    ]);

    console.log('WHOOP data counts — recovery:', (recovery.records||[]).length, 'sleep:', (sleep.records||[]).length, 'cycles:', (cycles.records||[]).length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: tokens.access_token,
        recovery: recovery.records || [],
        sleep: sleep.records || [],
        cycles: cycles.records || [],
        _debug: { recoveryCount: (recovery.records||[]).length, sleepCount: (sleep.records||[]).length, cyclesCount: (cycles.records||[]).length, recoveryKeys: Object.keys(recovery), sleepKeys: Object.keys(sleep) }
      })
    };

  } catch (err) {
    console.error('whoop-auth error:', err.message, err.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', message: err.message })
    };
  }
};
