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
    const body = JSON.parse(event.body);
    let accessToken;

    // Support two modes: OAuth code exchange, or direct access_token refresh
    if (body.access_token) {
      accessToken = body.access_token;
    } else {
      const { code, client_id, client_secret, redirect_uri } = body;

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

      accessToken = tokens.access_token;
    }

    // Verify token with user profile
    const profileRes = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profileText = await profileRes.text();
    console.log('WHOOP profile', profileRes.status, profileText.substring(0, 200));

    // Fetch WHOOP data using the access token (max limit is 25 per page)
    const [recoveryRes, sleepRes, cycleRes] = await Promise.all([
      fetch('https://api.prod.whoop.com/developer/v1/recovery?limit=25', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      fetch('https://api.prod.whoop.com/developer/v1/activity/sleep?limit=25', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      fetch('https://api.prod.whoop.com/developer/v1/cycle?limit=25', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ]);

    const safeJson = async (res) => {
      const text = await res.text();
      console.log('WHOOP data response', res.url, res.status, text.substring(0, 500));
      try { return JSON.parse(text); } catch(e) { return { _raw: text, _status: res.status }; }
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
        access_token: accessToken,
        recovery: recovery.records || [],
        sleep: sleep.records || [],
        cycles: cycles.records || []
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
