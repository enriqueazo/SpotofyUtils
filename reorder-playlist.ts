// reorder-playlist.ts — Reorder a playlist by reversing track order
import 'dotenv/config';
import SpotifyWebApi from 'spotify-web-api-node';

// Env typing
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

// Extraer el ID de una playlist desde una URL o ID directo
function extractPlaylistId(input: string): string {
  const m = input.match(/playlist\/([a-zA-Z0-9]+)|^([a-zA-Z0-9]+)$/);
  const id = m?.[1] ?? m?.[2];
  if (!id) throw new Error('Could not parse playlist ID from input.');
  return id;
}

// Tipos auxiliares mínimos para las respuestas que usamos
type TrackItem = { track?: { uri?: string; is_local?: boolean } | null };

// Función principal
async function main(): Promise<void> {
  try {
    // Obtener URL o ID de la playlist de los argumentos
    const sourceInput = process.argv[2];
    const targetInput = process.argv[3]; // opcional: playlist de destino
    if (!sourceInput) {
      console.error('Usage: node dist/reorder-playlist.js <sourcePlaylistUrlOrId> [targetPlaylistUrlOrId]');
      console.error('If targetPlaylistUrlOrId is provided, tracks will be added to that existing playlist in reverse order');
      console.error('If not provided, the script will attempt to create a new playlist (may fail)');
      process.exit(1);
      return;
    }

    console.log(`Starting process for: ${sourceInput}`);

    // Extraer el ID de la playlist de origen
    const playlistId = extractPlaylistId(sourceInput);
    console.log(`Extracted source playlist ID: ${playlistId}`);

    // Si se proporcionó una playlist de destino, extraer su ID también
    let targetPlaylistId: string | null = null;
    if (targetInput) {
      targetPlaylistId = extractPlaylistId(targetInput);
      console.log(`Extracted target playlist ID: ${targetPlaylistId}`);
    }

    // Refrescar token de acceso
    console.log('Refreshing access token...');
    const { body: tokenData } = await spotify.refreshAccessToken();
    spotify.setAccessToken(tokenData.access_token);
    console.log('Access token refreshed successfully');

    // Obtener información de la playlist origen
    console.log(`Getting information for playlist: ${playlistId}`);
    const { body: playlist } = await spotify.getPlaylist(playlistId);
    console.log(`Found playlist: "${playlist.name}" by ${playlist.owner?.display_name ?? playlist.owner?.id}`);

    // Obtener información del usuario actual
    console.log('Getting current user information...');
    const { body: user } = await spotify.getMe();
    console.log(`Current user: ${user.display_name ?? user.id}`);

    // Determinar la playlist de destino
    let targetId: string;
    let targetName: string;

    if (targetPlaylistId) {
      // Usar una playlist existente como destino
      console.log(`Using existing playlist as target: ${targetPlaylistId}`);
      try {
        const { body: target } = await spotify.getPlaylist(targetPlaylistId);
        targetName = target.name;
        targetId = target.id;
        console.log(`Target playlist: "${targetName}" (${targetId})`);
      } catch (error: any) {
        console.error(`Error accessing target playlist: ${error?.message ?? error}`);
        process.exit(1);
        return;
      }
    } else {
      // Intentar crear una nueva playlist
      const timestamp = Date.now().toString().slice(-6);
      const newPlaylistName = `${playlist.name} (reversed-${timestamp})`;
      const newPlaylistDesc = `Reversed copy of "${playlist.name}" created on ${new Date().toISOString()}`;
      const isPublic = false; // privadas por defecto

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
        console.log(`node dist/reorder-playlist.js ${sourceInput} YOUR_TARGET_PLAYLIST_ID_HERE`);
        process.exit(1);
        return;
      }
    }
    console.log(`Using playlist: "${targetName}" (${targetId})`);

    // Obtener pistas de la playlist original
    console.log('Getting tracks from source playlist...');
    const tracks: string[] = [];
    let offset = 0;
    const limit = 100;

    // Obtener todas las pistas en lotes
    while (true) {
      const { body } = await spotify.getPlaylistTracks(playlistId, {
        offset,
        limit,
        fields: 'items(track(uri,is_local)),total',
      });

      const items = (body.items ?? []) as TrackItem[];

      // Filtrar las canciones (excluir locales y nulas)
      for (const item of items) {
        const t = item?.track;
        if (t && !t.is_local && t.uri) tracks.push(t.uri);
      }

      if (items.length < limit) break;
      offset += items.length;
    }

    console.log(`Found ${tracks.length} valid tracks`);

    if (tracks.length === 0) {
      console.log('No valid tracks found to reorder. Ending process.');
      return;
    }

    // Eliminar duplicados manteniendo el orden
    const seen = new Set<string>();
    const uniqueTracks = tracks.filter(u => (seen.has(u) ? false : (seen.add(u), true)));
    if (uniqueTracks.length < tracks.length) {
      console.log(`Removed ${tracks.length - uniqueTracks.length} duplicate tracks`);
    }

    // Invertir el orden de las canciones
    const reversedTracks = [...uniqueTracks].reverse();
    console.log(`Reversed the order of ${uniqueTracks.length} tracks`);

    // Añadir pistas a la playlist de destino en lotes
    console.log(`Adding ${reversedTracks.length} tracks to the playlist...`);
    for (let i = 0; i < reversedTracks.length; i += 100) {
      const batch = reversedTracks.slice(i, i + 100);
      console.log(`Adding batch ${Math.floor(i / 100) + 1}/${Math.ceil(reversedTracks.length / 100)}...`);
      await spotify.addTracksToPlaylist(targetId, batch);
    }

    console.log(`✅ Successfully added ${reversedTracks.length} tracks to "${targetName}" (${targetId}) in reverse order`);
    console.log('Process completed!');
  } catch (error: any) {
    console.error('Error:', error?.message ?? error);
    const body = error?.response?.body;
    if (body) {
      console.error('API Error details:', JSON.stringify(body, null, 2));
    }
    process.exit(1);
  }
}

// Ejecutar programa principal
main();
