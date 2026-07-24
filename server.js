const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Servimos el index.html estático
app.use(express.static(__dirname)); 

// --- CONFIGURACIÓN DE TU APP CLIENTE ---
const CLIENT_ID = '1'; // El ID de tu app
const CLIENT_SECRET = '1eeb5ce5f6d28e7f277e644bde4f4eb226ea316f8c3ecaa083a5c012d39a25cf'
const SSO_BASE_URL = 'http://localhost:3000';
const REDIRECT_URI = 'http://localhost:8080/callback';

// Este es el endpoint que tu frontend va a llamar cuando reciba el code
app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;
  
  try {
    // PASO 3: El backend canjea el code por los tokens
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

    // PASO 4 (Opcional pero útil): Ya que tenemos el token, pedimos los datos del alumno
    const userResponse = await fetch(`${SSO_BASE_URL}/sso/me`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();

    // Le devolvemos todo al frontend para que lo muestre en pantalla
    res.json({ 
      tokens: tokenData, 
      user: userData 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(8080, () => {
  console.log('App Cliente levantada en http://localhost:8080');
});