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

    const tokens = await tokenRes.json();

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

    const [recovery, sleep, cycles] = await Promise.all([
      recoveryRes.json(),
      sleepRes.json(),
      cycleRes.json()
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: tokens.access_token,
        recovery: recovery.records || [],
        sleep: sleep.records || [],
        cycles: cycles.records || []
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', message: err.message })
    };
  }
};
