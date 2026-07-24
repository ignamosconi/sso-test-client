require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3001;

const SSO_BASE_URL = process.env.SSO_BASE_URL;
const SSO_CLIENT_ID = process.env.SSO_CLIENT_ID;
const SSO_CLIENT_SECRET = process.env.SSO_CLIENT_SECRET;
const SSO_REDIRECT_URI = process.env.SSO_REDIRECT_URI;

app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.static(path.join(__dirname, 'public')));

/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'SSO test backend funcionando',
  });
});

/*
|--------------------------------------------------------------------------
| OAuth callback
|--------------------------------------------------------------------------
|
| El frontend recibe el authorization code del popup
| y lo manda acá.
|
*/

app.post('/api/auth/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'missing_code',
        message: 'No se recibió authorization code',
      });
    }

    console.log('\n==============================');
    console.log('AUTHORIZATION CODE RECIBIDO');
    console.log('==============================');

    /*
    |--------------------------------------------------------------------------
    | Canje del authorization code por tokens
    |--------------------------------------------------------------------------
    */

    const tokenResponse = await fetch(
      `${SSO_BASE_URL}/sso/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: Number(SSO_CLIENT_ID),
          client_secret: SSO_CLIENT_SECRET,
          code,
          redirect_uri: SSO_REDIRECT_URI,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Error obteniendo tokens:', tokenData);

      return res.status(tokenResponse.status).json({
        error: 'token_exchange_failed',
        details: tokenData,
      });
    }

    const {
      access_token,
      refresh_token,
      token_type,
      expires_in,
    } = tokenData;

    /*
    |--------------------------------------------------------------------------
    | Obtener información del alumno
    |--------------------------------------------------------------------------
    */

    const meResponse = await fetch(
      `${SSO_BASE_URL}/sso/me`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const userData = await meResponse.json();

    if (!meResponse.ok) {
      return res.status(meResponse.status).json({
        error: 'me_request_failed',
        details: userData,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DEMO
    |--------------------------------------------------------------------------
    |
    | Para un sistema real:
    |
    | - access_token -> backend
    | - refresh_token -> backend
    |
    | No deberían viajar al frontend.
    |
    | Para este test los guardamos temporalmente en memoria.
    |
    */

    global.ssoSession = {
      access_token,
      refresh_token,
      token_type,
      expires_in,
      user: userData,
      created_at: new Date().toISOString(),
    };

    console.log('\n==============================');
    console.log('LOGIN SSO EXITOSO');
    console.log('==============================');

    console.log('Usuario:', userData);
    console.log('Access token recibido:', Boolean(access_token));
    console.log('Refresh token recibido:', Boolean(refresh_token));
    console.log('Expires in:', expires_in);

    return res.json({
      success: true,
      message: 'SSO login exitoso',
      user: userData,
      token_info: {
        token_type,
        expires_in,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'internal_server_error',
      message: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| Obtener sesión actual
|--------------------------------------------------------------------------
*/

app.get('/api/auth/session', (req, res) => {
  if (!global.ssoSession) {
    return res.status(401).json({
      authenticated: false,
    });
  }

  res.json({
    authenticated: true,
    user: global.ssoSession.user,
    token_info: {
      token_type: global.ssoSession.token_type,
      expires_in: global.ssoSession.expires_in,
      created_at: global.ssoSession.created_at,
    },
  });
});

/*
|--------------------------------------------------------------------------
| REFRESH
|--------------------------------------------------------------------------
*/

app.post('/api/auth/refresh', async (req, res) => {
  try {
    if (!global.ssoSession?.refresh_token) {
      return res.status(401).json({
        error: 'no_refresh_token',
        message: 'No existe una sesión con refresh token',
      });
    }

    const oldRefreshToken = global.ssoSession.refresh_token;

    const refreshResponse = await fetch(
      `${SSO_BASE_URL}/sso/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: oldRefreshToken,
        }),
      }
    );

    const refreshData = await refreshResponse.json();

    if (!refreshResponse.ok) {
      console.error('Error en refresh:', refreshData);

      return res.status(refreshResponse.status).json({
        error: 'refresh_failed',
        details: refreshData,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ROTACIÓN
    |--------------------------------------------------------------------------
    |
    | El SSO devuelve un nuevo access token
    | y un nuevo refresh token.
    |
    | El refresh token anterior queda inválido.
    |--------------------------------------------------------------------------
    */

    global.ssoSession.access_token = refreshData.access_token;
    global.ssoSession.refresh_token = refreshData.refresh_token;

    console.log('\n==============================');
    console.log('REFRESH EXITOSO');
    console.log('==============================');

    console.log('Nuevo access token recibido:', Boolean(refreshData.access_token));
    console.log('Nuevo refresh token recibido:', Boolean(refreshData.refresh_token));

    return res.json({
      success: true,
      message: 'Refresh exitoso',
      token_info: {
        token_type: refreshData.token_type,
        expires_in: refreshData.expires_in,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'internal_server_error',
      message: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

app.post('/api/auth/logout', async (req, res) => {
  try {
    if (!global.ssoSession?.refresh_token) {
      return res.status(401).json({
        error: 'no_session',
      });
    }

    const response = await fetch(
      `${SSO_BASE_URL}/sso/logout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: global.ssoSession.refresh_token,
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json();

      return res.status(response.status).json({
        error: 'logout_failed',
        details: data,
      });
    }

    global.ssoSession = null;

    console.log('\n==============================');
    console.log('LOGOUT EXITOSO');
    console.log('==============================');

    return res.status(204).send();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'internal_server_error',
      message: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(`
========================================

SSO TEST APP

Frontend:
http://localhost:${PORT}

SSO:
${SSO_BASE_URL}

========================================
`);
});