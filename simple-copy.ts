// simple-copy.ts — copy to an existing playlist or create a new one
import 'dotenv/config';
import SpotifyWebApi from 'spotify-web-api-node';

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_REFRESH_TOKEN,
} = process.env as Record<string, string | undefined>;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI || !SPOTIFY_REFRESH_TOKEN) {
  throw new Error('Missing required environment variables');
}

const spotify = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: SPOTIFY_REDIRECT_URI,
});
spotify.setRefreshToken(SPOTIFY_REFRESH_TOKEN);

function extractPlaylistId(input: string): string {
  const m = input.match(/playlist\/([a-zA-Z0-9]+)|^([a-zA-Z0-9]+)$/);
  const id = m?.[1] ?? m?.[2];
  if (!id) throw new Error('Could not parse playlist ID from input.');
  return id;
}

async function main(): Promise<void> {
  const sourceInput = process.argv[2];
  const targetInput = process.argv[3]; // optional target playlist

  if (!sourceInput) {
    console.error('Usage: node dist/simple-copy.js <sourcePlaylistUrlOrId> [targetPlaylistUrlOrId]');
    process.exit(1);
  }

  console.log(`Starting process for: ${sourceInput}`);

  const playlistId = extractPlaylistId(sourceInput);
  console.log(`Extracted source playlist ID: ${playlistId}`);

  let targetPlaylistId: string | null = null;
  if (targetInput) {
    targetPlaylistId = extractPlaylistId(targetInput);
    console.log(`Extracted target playlist ID: ${targetPlaylistId}`);
  }

  console.log('Refreshing access token...');
  const { body: tokenData } = await spotify.refreshAccessToken();
  spotify.setAccessToken(tokenData.access_token);
  console.log('Access token refreshed successfully');

  console.log(`Getting information for playlist: ${playlistId}`);
  const { body: playlist } = await spotify.getPlaylist(playlistId);
  console.log(`Found playlist: "${playlist.name}" by ${playlist.owner?.display_name ?? playlist.owner?.id}`);

  console.log('Getting current user information...');
  const { body: user } = await spotify.getMe();
  console.log(`Current user: ${user.display_name ?? user.id}`);

  let targetId: string;
  let targetName: string;

  if (targetPlaylistId) {
    console.log(`Using existing playlist as target: ${targetPlaylistId}`);
    try {
      const { body: target } = await spotify.getPlaylist(targetPlaylistId);
      targetId = target.id;
      targetName = target.name;
      console.log(`Target playlist: "${targetName}" (${targetId})`);
    } catch (error: any) {
      console.error(`Error accessing target playlist: ${error.message}`);
      process.exit(1);
      return;
    }
  } else {
    const timestamp = Date.now().toString().slice(-6);
    const newPlaylistName = `${playlist.name} (copy-${timestamp})`;
    const newPlaylistDesc = `Copy of "${playlist.name}" created on ${new Date().toISOString()}`;
    const isPublic = false;

    console.log(`Creating new playlist: "${newPlaylistName}"`);
    try {
      const response = await spotify.createPlaylist(newPlaylistName, {
        description: newPlaylistDesc,
        public: isPublic,
      });
      targetId = response.body.id;
      targetName = response.body.name;
    } catch (error) {
      console.error('Error creating playlist. Please create one manually and re-run with target ID.');
      console.log(`node dist/simple-copy.js ${sourceInput} YOUR_TARGET_PLAYLIST_ID`);
      process.exit(1);
      return;
    }
  }

  console.log(`Using playlist: "${targetName}" (${targetId})`);

  // Fetch tracks from source in pages
  console.log('Getting tracks from source playlist...');
  const uris: string[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { body } = await spotify.getPlaylistTracks(playlistId, {
      offset,
      limit,
      fields: 'items(track(uri,is_local)),total',
    });

    const items = (body.items ?? []) as Array<{ track?: { uri?: string; is_local?: boolean } | null }>;
    for (const item of items) {
      const t = item?.track;
      if (t && !t.is_local && t.uri) uris.push(t.uri);
    }

    if (items.length < limit) break;
    offset += items.length;
  }

  console.log(`Found ${uris.length} valid tracks`);
  if (uris.length === 0) {
    console.log('No valid tracks found to copy. Ending process.');
    return;
  }

  // De-duplicate while preserving order
  const seen = new Set<string>();
  const unique = uris.filter(u => (seen.has(u) ? false : (seen.add(u), true)));
  if (unique.length < uris.length) {
    console.log(`Removed ${uris.length - unique.length} duplicate tracks`);
  }

  // Add tracks to target in batches of 100
  console.log(`Adding ${unique.length} tracks to the playlist...`);
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    console.log(`Adding batch ${Math.floor(i / 100) + 1}/${Math.ceil(unique.length / 100)}...`);
    await spotify.addTracksToPlaylist(targetId, batch);
  }

  console.log(`✅ Successfully copied ${unique.length} tracks to "${targetName}" (${targetId})`);
  console.log('Process completed!');
}

main().catch((error: any) => {
  console.error('Error:', error?.message ?? error);
  const body = (error as any)?.response?.body;
  if (body) console.error('API Error details:', JSON.stringify(body, null, 2));
  process.exit(1);
});
