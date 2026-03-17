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

    // Exchange the code for tokens with Strava
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id,
        client_secret,
        code,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok || !tokens.access_token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token exchange failed', details: tokens })
      };
    }

    // Fetch last 90 days of activities
    const after = Math.floor(Date.now() / 1000) - (90 * 86400);
    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=100&after=${after}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    const activities = await activitiesRes.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: tokens.access_token,
        athlete: tokens.athlete || null,
        activities: Array.isArray(activities) ? activities : []
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
