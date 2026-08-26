require('dotenv').config();
const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SSO_BASE_URL = process.env.SSO_BASE_URL;
const CLIENT_ID = process.env.SSO_CLIENT_ID;
const CLIENT_SECRET = process.env.SSO_CLIENT_SECRET;
const REDIRECT_URI = process.env.SSO_REDIRECT_URI;

// Servimos el index.html inyectando las variables de entorno
app.get('/', (req, res) => {
  let html = fs.readFileSync('./index.html', 'utf8');
  html = html
    .replace('__CLIENT_ID__', CLIENT_ID)
    .replace('__REDIRECT_URI__', REDIRECT_URI)
    .replace('__SSO_BASE_URL__', SSO_BASE_URL);
  res.send(html);
});

app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;
  
  try {
    const tokenResponse = await fetch(`${SSO_BASE_URL}/sso/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(tokenResponse.status).json(tokenData);
    }

    const userResponse = await fetch(`${SSO_BASE_URL}/sso/me`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();

    res.json({ tokens: tokenData, user: userData });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`App Cliente levantada en http://localhost:${PORT}`);
});