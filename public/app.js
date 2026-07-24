const loginButton = document.getElementById('loginButton');
const sessionButton = document.getElementById('sessionButton');
const refreshButton = document.getElementById('refreshButton');
const logoutButton = document.getElementById('logoutButton');

const result = document.getElementById('result');
const success = document.getElementById('success');
const userData = document.getElementById('userData');

const SSO_BASE_URL = 'http://localhost:3000';

const SSO_CLIENT_ID = '1';

const SSO_REDIRECT_URI =
  'http://localhost:3001/callback';

const SSO_ORIGIN =
  'http://localhost:3000';

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

loginButton.addEventListener('click', () => {

  /*
  |--------------------------------------------------------------------------
  | Generar state
  |--------------------------------------------------------------------------
  */

  const state = crypto.randomUUID();

  sessionStorage.setItem(
    'oauth_state',
    state
  );

  /*
  |--------------------------------------------------------------------------
  | Abrir popup
  |--------------------------------------------------------------------------
  */

  const loginUrl =
    `${SSO_BASE_URL}/sso/login` +
    `?client_id=${encodeURIComponent(SSO_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(SSO_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}` +
    `&theme=light`;

  window.ssoPopup = window.open(
    loginUrl,
    'sso_login',
    'width=480,height=600'
  );

  if (!window.ssoPopup) {
    showResult({
      error: 'El navegador bloqueó el popup',
    });

    return;
  }

  showResult({
    message: 'Popup de SSO abierto. Esperando autenticación...',
  });

});

/*
|--------------------------------------------------------------------------
| ESCUCHAR RESULTADO DEL SSO
|--------------------------------------------------------------------------
*/

window.addEventListener('message', async (event) => {
  console.log('==============================');
  console.log('MESSAGE RECIBIDO');
  console.log('==============================');

  console.log('event.origin:', event.origin);
  console.log('event.data:', event.data);
  console.log('event.source:', event.source);

  /*
  |--------------------------------------------------------------------------
  | El SSO debe enviar el mensaje desde:
  |
  | http://localhost:3000
  |--------------------------------------------------------------------------
  */

  if (event.origin !== SSO_ORIGIN) {
    console.warn(
      'Mensaje ignorado: origin inválido'
    );

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | El SSO envía:
  |
  | {
  |   status: 'success',
  |   code: '...',
  |   state: '...'
  | }
  |--------------------------------------------------------------------------
  */

  const {
    status,
    code,
    state,
  } = event.data || {};

  if (status !== 'success') {
    showResult({
      error: 'sso_login_failed',
      message: 'El SSO no devolvió status success',
      data: event.data,
    });

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | Verificar que el mensaje proviene del popup que abrimos
  |--------------------------------------------------------------------------
  */

  if (
    !window.ssoPopup ||
    event.source !== window.ssoPopup
  ) {
    console.warn(
      'Mensaje ignorado: no proviene del popup SSO esperado'
    );

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | Procesar code + state
  |--------------------------------------------------------------------------
  */

  await processSSOResult({
    code,
    state,
  });
});


async function processSSOResult({
  code,
  state,
}) {
  console.log('Procesando resultado SSO');

  const expectedState =
    sessionStorage.getItem('oauth_state');

  console.log({
    receivedState: state,
    expectedState,
    code,
  });

  if (!state || state !== expectedState) {
    showResult({
      error: 'invalid_state',
      message: 'El state no coincide',
      received_state: state,
      expected_state: expectedState,
    });

    return;
  }

  sessionStorage.removeItem('oauth_state');

  if (!code) {
    showResult({
      error: 'missing_code',
      message: 'No se recibió authorization code',
    });

    return;
  }

  showResult({
    message: 'Authorization code recibido',
    code,
  });

  const response = await fetch(
    '/api/auth/callback',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        code,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    showResult(data);
    return;
  }

  success.classList.remove('hidden');

  userData.textContent =
    JSON.stringify(data.user, null, 2);

  showResult(data);
}


/*
|--------------------------------------------------------------------------
| CONSULTAR SESIÓN
|--------------------------------------------------------------------------
*/

sessionButton.addEventListener('click', async () => {

  const response = await fetch(
    '/api/auth/session'
  );

  const data = await response.json();

  showResult(data);
});

/*
|--------------------------------------------------------------------------
| REFRESH
|--------------------------------------------------------------------------
*/

refreshButton.addEventListener('click', async () => {

  const response = await fetch(
    '/api/auth/refresh',
    {
      method: 'POST',
    }
  );

  const data = await response.json();

  showResult(data);
});

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

logoutButton.addEventListener('click', async () => {

  const response = await fetch(
    '/api/auth/logout',
    {
      method: 'POST',
    }
  );

  if (response.status === 204) {

    success.classList.add('hidden');

    showResult({
      success: true,
      message: 'Logout exitoso',
    });

    return;
  }

  const data = await response.json();

  showResult(data);
});

/*
|--------------------------------------------------------------------------
| UI
|--------------------------------------------------------------------------
*/

function showResult(data) {

  result.textContent =
    JSON.stringify(data, null, 2);
}