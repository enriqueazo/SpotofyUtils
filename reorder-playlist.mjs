// reorder-playlist.mjs - Versión para reordenar una playlist invirtiendo el orden de las canciones
import 'dotenv/config';
import SpotifyWebApi from 'spotify-web-api-node';

// Configuración inicial
const {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REDIRECT_URI,
    SPOTIFY_REFRESH_TOKEN,
} = process.env;

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
function extractPlaylistId(input) {
  const m = input.match(/playlist\/([a-zA-Z0-9]+)|^([a-zA-Z0-9]+)$/);
  const id = m?.[1] || m?.[2];
  if (!id) throw new Error('Could not parse playlist ID from input.');
  return id;
}

// Función principal
async function main() {
  try {
    // Obtener URL o ID de la playlist de los argumentos
    const sourceInput = process.argv[2];
    const targetInput = process.argv[3]; // Ahora acepta opcionalmente un segundo argumento para la playlist de destino
    if (!sourceInput) {
      console.error('Usage: node reorder-playlist.mjs <sourcePlaylistUrlOrId> [targetPlaylistUrlOrId]');
      console.error('If targetPlaylistUrlOrId is provided, tracks will be added to that existing playlist in reverse order');
      console.error('If not provided, the script will attempt to create a new playlist (may fail)');
      process.exit(1);
    }
    
    console.log(`Starting process for: ${sourceInput}`);
    
    // Extraer el ID de la playlist de origen
    const playlistId = extractPlaylistId(sourceInput);
    console.log(`Extracted source playlist ID: ${playlistId}`);
    
    // Si se proporcionó una playlist de destino, extraer su ID también
    let targetPlaylistId = null;
    if (targetInput) {
      targetPlaylistId = extractPlaylistId(targetInput);
      console.log(`Extracted target playlist ID: ${targetPlaylistId}`);
    }
    
    // Refrescar token de acceso
    console.log('Refreshing access token...');
    const tokenData = await spotify.refreshAccessToken();
    spotify.setAccessToken(tokenData.body.access_token);
    console.log('Access token refreshed successfully');
    
    // Obtener información de la playlist origen
    console.log(`Getting information for playlist: ${playlistId}`);
    const playlistData = await spotify.getPlaylist(playlistId);
    const playlist = playlistData.body;
    console.log(`Found playlist: "${playlist.name}" by ${playlist.owner.display_name}`);
    
    // Obtener información del usuario actual
    console.log('Getting current user information...');
    const userData = await spotify.getMe();
    const user = userData.body;
    console.log(`Current user: ${user.display_name} (${user.id})`);
    
    // Determinar la playlist de destino
    let targetId;
    let targetName;
    
    if (targetPlaylistId) {
      // Si se proporcionó una playlist de destino, usarla
      console.log(`Using existing playlist as target: ${targetPlaylistId}`);
      try {
        const targetPlaylistData = await spotify.getPlaylist(targetPlaylistId);
        targetName = targetPlaylistData.body.name;
        targetId = targetPlaylistId;
        console.log(`Target playlist: "${targetName}" (${targetId})`);
      } catch (error) {
        console.error(`Error accessing target playlist: ${error.message}`);
        process.exit(1);
      }
    } else {
      // Intentar crear una nueva playlist
      const timestamp = new Date().getTime().toString().slice(-6);
      const newPlaylistName = `${playlist.name} (reversed-${timestamp})`;
      const newPlaylistDesc = `Reversed copy of "${playlist.name}" created on ${new Date().toISOString()}`;
      const isPublic = false; // Crear playlists privadas por defecto
      
      console.log(`Creating new playlist: "${newPlaylistName}"`);
      
      try {
        // Intento con promesas
        const createData = await spotify.createPlaylist(user.id, newPlaylistName, {
          description: newPlaylistDesc,
          public: isPublic
        });
        targetId = createData.body.id;
        targetName = createData.body.name;
      } catch (error) {
        console.error('Error creating playlist with promise API.');
        console.log("Por favor, crea manualmente una playlist en tu cuenta de Spotify");
        console.log("Y luego ejecuta este script con la URL/ID de la playlist de origen Y la URL/ID de tu playlist como segundo argumento:");
        console.log(`node reorder-playlist.mjs ${sourceInput} TU_PLAYLIST_ID_AQUI`);
        process.exit(1);
      }
    }
    console.log(`Using playlist: "${targetName}" (${targetId})`);
    
    // Obtener pistas de la playlist original
    console.log(`Getting tracks from source playlist...`);
    let tracks = [];
    let offset = 0;
    let hasMore = true;
    const limit = 100;
    
    // Obtener todas las pistas en lotes
    while (hasMore) {
      const tracksData = await spotify.getPlaylistTracks(playlistId, { 
        offset, 
        limit,
        fields: 'items(track(uri,is_local)),total,next'
      });
      
      const items = tracksData.body.items;
      // Filtrar las canciones (excluir locales y nulas)
      const validTracks = items
        .filter(item => item.track && !item.track.is_local)
        .map(item => item.track.uri);
      
      tracks = tracks.concat(validTracks);
      offset += items.length;
      hasMore = items.length === limit;
    }
    
    console.log(`Found ${tracks.length} valid tracks`);
    
    if (tracks.length === 0) {
      console.log('No valid tracks found to reorder. Ending process.');
      return;
    }
    
    // Eliminar duplicados manteniendo el orden
    const uniqueTracks = [...new Set(tracks)];
    if (uniqueTracks.length < tracks.length) {
      console.log(`Removed ${tracks.length - uniqueTracks.length} duplicate tracks`);
    }
    
    // Invertir el orden de las canciones (primera -> última, segunda -> penúltima, etc.)
    const reversedTracks = [...uniqueTracks].reverse();
    console.log(`Reversed the order of ${uniqueTracks.length} tracks`);
    
    // Añadir pistas a la playlist de destino en lotes
    console.log(`Adding ${reversedTracks.length} tracks to the playlist...`);
    for (let i = 0; i < reversedTracks.length; i += 100) {
      const batch = reversedTracks.slice(i, i + 100);
      console.log(`Adding batch ${Math.floor(i/100) + 1}/${Math.ceil(reversedTracks.length/100)}...`);
      await spotify.addTracksToPlaylist(targetId, batch);
    }
    
    console.log(`✅ Successfully added ${reversedTracks.length} tracks to "${targetName}" (${targetId}) in reverse order`);
    console.log('Process completed!');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response && error.response.body) {
      console.error('API Error details:', JSON.stringify(error.response.body, null, 2));
    }
    process.exit(1);
  }
}

// Ejecutar programa principal
main();
