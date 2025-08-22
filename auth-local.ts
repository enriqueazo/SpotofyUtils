// auth-local.ts
import 'dotenv/config';
import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import crypto from 'crypto';
import open from 'open';

const port = 5173;
const host = '127.0.0.1';
const redirectUri = `http://${host}:${port}/callback`;

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env'); process.exit(1);
}

const spotify = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri,
});

const app = express();
const scopes = [
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
];

let expectedState = crypto.randomBytes(16).toString('hex');

app.get('/login', (_req, res) => {
  const url = spotify.createAuthorizeURL(scopes, expectedState, true);
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  if (!code || state !== expectedState) {
    return res.status(400).send('State mismatch or missing code');
  }
  try {
    const { body } = await spotify.authorizationCodeGrant(code);
    console.log('\n✅ Save this refresh token to your .env as SPOTIFY_REFRESH_TOKEN:\n');
    console.log(body.refresh_token, '\n');
    res.send('All set! Refresh token printed in the terminal. You can close this tab.');
    // optional: end the process after a short delay
    setTimeout(() => process.exit(0), 1000);
  } catch (e) {
    console.error(e);
    res.status(500).send('Auth failed');
  }
});

app.listen(port, host, async () => {
  console.log(`Auth server on http://${host}:${port}`);
  await open(`http://${host}:${port}/login`);
});
