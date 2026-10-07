import type { AuditDatasetMode, SpotifyTrackItem, UnifiedPlaylist } from '../types';

const esNumberFormatter = new Intl.NumberFormat('es-ES');
const esPluralRules = new Intl.PluralRules('es-ES');

export function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return esNumberFormatter.format(Math.round(value));
}

export function formatTrackCount(count: number | null | undefined): string {
  const safe = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  const rule = esPluralRules.select(safe);
  const noun = rule === 'one' ? 'pista' : 'pistas';
  return `${esNumberFormatter.format(safe)} ${noun}`;
}

export function formatPlaylistCount(count: number | null | undefined): string {
  const safe = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  const rule = esPluralRules.select(safe);
  const noun = rule === 'one' ? 'playlist' : 'playlists';
  return `${esNumberFormatter.format(safe)} ${noun}`;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return '—:—';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const DEMO_CITY_POP_TRACKS: SpotifyTrackItem[] = [
  {
    id: 'cp-1',
    artist: 'Taeko Onuki',
    name: '4:00A.M.',
    query: 'Taeko Onuki - 4:00A.M.',
    duration_ms: 336000,
  },
  {
    id: 'cp-2',
    artist: '桐生一馬(黒田崇矢), SEGA GAME MUSIC, SEGA SOUND TEAM',
    name: 'BAKAMITAI - Taxi Driver Edition',
    query: '桐生一馬(黒田崇矢), SEGA GAME MUSIC, SEGA SOUND TEAM - BAKAMITAI - Taxi Driver Edition',
    duration_ms: 292000,
  },
  {
    id: 'cp-3',
    artist: 'Miki Matsubara',
    name: 'Neat na Gogo 3 Ji',
    query: 'Miki Matsubara - Neat na Gogo 3 Ji',
    duration_ms: 244000,
  },
  {
    id: 'cp-4',
    artist: 'Anri',
    name: "悲しみがとまらない I CAN'T STOP THE LONELINESS",
    query: "Anri - 悲しみがとまらない I CAN'T STOP THE LONELINESS",
    duration_ms: 263000,
  },
  {
    id: 'cp-5',
    artist: 'Anri',
    name: 'Last Summer Whisper',
    query: 'Anri - Last Summer Whisper',
    duration_ms: 300000,
  },
  {
    id: 'cp-6',
    artist: 'Tomoko Aran',
    name: 'Midnight Pretenders - 2022 restored version',
    query: 'Tomoko Aran - Midnight Pretenders - 2022 restored version',
    duration_ms: 344000,
  },
  {
    id: 'cp-7',
    artist: 'Junko Yagami',
    name: '黄昏のBAY CITY',
    query: 'Junko Yagami - 黄昏のBAY CITY',
    duration_ms: 258000,
  },
  {
    id: 'cp-8',
    artist: 'Yasuha',
    name: 'Fly-day Chinatown',
    query: 'Yasuha - Fly-day Chinatown',
    duration_ms: 210000,
  },
];

const DEMO_LIKED_TRACKS: SpotifyTrackItem[] = [
  {
    id: 'lk-1',
    artist: '植田能平',
    name: 'あの日の出来事',
    query: '植田能平 - あの日の出来事',
    duration_ms: 198000,
  },
  {
    id: 'lk-2',
    artist: 'LMR City Pop, Mei, R!zumu',
    name: '(You And Me Still Keep On) Fall In Love 1981',
    query: 'LMR City Pop, Mei, R!zumu - (You And Me Still Keep On) Fall In Love 1981',
    duration_ms: 231000,
  },
  {
    id: 'lk-3',
    artist: 'Kingo Hamada',
    name: '街のドルフィン - 2020 Remaster',
    query: 'Kingo Hamada - 街のドルフィン - 2020 Remaster',
    duration_ms: 254000,
  },
  {
    id: 'lk-4',
    artist: 'Yukiko Okada',
    name: '水色プリンセス -水の精-',
    query: 'Yukiko Okada - 水色プリンセス -水の精-',
    duration_ms: 229000,
  },
  {
    id: 'lk-5',
    artist: 'Iyo Matsumoto',
    name: 'それから',
    query: 'Iyo Matsumoto - それから',
    duration_ms: 247000,
  },
  {
    id: 'lk-6',
    artist: 'Panic! At The Disco',
    name: 'House of Memories',
    query: 'Panic! At The Disco - House of Memories',
    duration_ms: 208000,
  },
];

const WORST_CASE_TRACKS: SpotifyTrackItem[] = [
  {
    id: 'wc-1',
    artist: '植田能平',
    name: 'あの日の出来事',
    query: '植田能平 - あの日の出来事',
    duration_ms: 214000,
  },
  {
    id: 'wc-2',
    artist:
      'DJ Luian, Mambo Kingz, De La Ghetto, Arcángel, Ozuna, Anuel AA, Bryant Myers, Almighty, Noriel, Baby Rasta, Brytiago, Alex Rose, Casper Magico, Ñengo Flow',
    name: '0 Sentimientos (Remix) [feat. Noriel, Darkiel, Lyan, Messiah & Baby Rasta] - Extended Studio Cut 2026',
    query:
      'DJ Luian, Mambo Kingz, De La Ghetto, Arcángel, Ozuna, Anuel AA, Bryant Myers, Almighty, Noriel, Baby Rasta, Brytiago, Alex Rose, Casper Magico, Ñengo Flow - 0 Sentimientos (Remix) [feat. Noriel, Darkiel, Lyan, Messiah & Baby Rasta] - Extended Studio Cut 2026',
    duration_ms: 564000,
  },
  {
    id: 'wc-3',
    artist: 'Jo',
    name: 'A',
    query: 'Jo - A',
    duration_ms: 0,
  },
  {
    id: 'wc-4',
    artist: 'Aleksandra Wiśniewska-Kowalczyk & Đặng Thị Ngọc Hân',
    name: 'Benachrichtigungseinstellungen_Unbreakable_Identifier_Track_9f8e7d6c5b4a4c3d8e2f1a0b9c8d7e6f_Remastered_v12_FINAL.flac',
    query:
      'Aleksandra Wiśniewska-Kowalczyk & Đặng Thị Ngọc Hân - Benachrichtigungseinstellungen_Unbreakable_Identifier_Track_9f8e7d6c5b4a4c3d8e2f1a0b9c8d7e6f_Remastered_v12_FINAL.flac',
    duration_ms: 46224000,
  },
  {
    id: 'wc-5',
    artist: '桐生一馬(黒田崇矢), SEGA GAME MUSIC, SEGA SOUND TEAM',
    name: 'BAKAMITAI - Taxi Driver Edition',
    query: '桐生一馬(黒田崇矢), SEGA GAME MUSIC, SEGA SOUND TEAM - BAKAMITAI - Taxi Driver Edition',
    duration_ms: 292000,
  },
  {
    id: 'wc-6',
    artist: 'Ólafur Darri Ólafsson',
    name: '<script>alert("xss")</script> &amp; **Literal Escaping Check**',
    query: 'Ólafur Darri Ólafsson - <script>alert("xss")</script> &amp; **Literal Escaping Check**',
    duration_ms: 185000,
  },
];

function buildHugeTrackList(count: number): SpotifyTrackItem[] {
  const basePool = [...DEMO_CITY_POP_TRACKS, ...DEMO_LIKED_TRACKS, ...WORST_CASE_TRACKS];
  const result: SpotifyTrackItem[] = [];
  for (let i = 0; i < count; i++) {
    const template = basePool[i % basePool.length];
    result.push({
      id: `huge-${i + 1}`,
      artist: template.artist,
      name: `${template.name} [Archivo #${i + 1}]`,
      query: `${template.artist} - ${template.name}`,
      duration_ms: template.duration_ms,
    });
  }
  return result;
}

export function getAuditDatasetPlaylists(mode: AuditDatasetMode): UnifiedPlaylist[] {
  switch (mode) {
    case 'empty':
      return [];

    case 'one':
      return [
        {
          id: 'audit-single-playlist',
          name: 'City pop',
          owner: 'mahdi-y',
          coverUrl: null,
          totalTracks: 1,
          tracks: [DEMO_CITY_POP_TRACKS[0]],
          tracksLoaded: true,
          sourceMode: 'audit-fixture',
        },
      ];

    case 'huge': {
      const hugeTracks = buildHugeTrackList(1284);
      return [
        {
          id: 'audit-huge-liked',
          name: 'Liked Songs from Spotify (Archivo Completo 1.284 pistas)',
          owner: 'Tu biblioteca personal',
          coverUrl: null,
          totalTracks: 1284,
          tracks: hugeTracks,
          tracksLoaded: true,
          isLikedSongs: true,
          sourceMode: 'audit-fixture',
        },
      ];
    }

    case 'worst':
      return [
        {
          id: 'wc-peripatetico',
          name: 'Música para estudiar como un peripatético del siglo IV que acaba de ser instruido por Aristóteles en el Liceo de Atenas durante el equinoccio de otoño',
          owner: 'Aleksandra Wiśniewska-Kowalczyk',
          coverUrl: 'https://invalid-domain.example.test/broken-cover-404.jpg',
          totalTracks: 100,
          tracks: WORST_CASE_TRACKS,
          tracksLoaded: true,
          isPartialEmbed: true,
          sourceMode: 'audit-fixture',
        },
        {
          id: 'wc-empty-title',
          name: '',
          owner: 'Jo',
          coverUrl: null,
          totalTracks: 0,
          tracks: [],
          tracksLoaded: true,
          sourceMode: 'audit-fixture',
        },
        {
          id: 'wc-unbreakable',
          name: 'GYM_HARDSTYLE_2026__HARDSTYLE_REMIX_SONGS_UNBREAKABLE_SLUG_WITH_NO_SPACES_AT_ALL_9f8e7d6c5b4a',
          owner: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com',
          coverUrl: null,
          totalTracks: 6,
          tracks: WORST_CASE_TRACKS,
          tracksLoaded: true,
          sourceMode: 'audit-fixture',
        },
      ];

    case 'demo':
    default:
      return [
        {
          id: 'demo-liked-songs',
          name: 'Liked Songs from Spotify',
          owner: 'Tu biblioteca personal',
          coverUrl: null,
          totalTracks: DEMO_LIKED_TRACKS.length,
          tracks: DEMO_LIKED_TRACKS,
          tracksLoaded: true,
          isLikedSongs: true,
          sourceMode: 'audit-fixture',
        },
        {
          id: 'demo-city-pop',
          name: 'City pop',
          owner: 'Colección Tokio 1984',
          coverUrl: null,
          totalTracks: DEMO_CITY_POP_TRACKS.length,
          tracks: DEMO_CITY_POP_TRACKS,
          tracksLoaded: true,
          sourceMode: 'audit-fixture',
        },
        {
          id: 'demo-peripatetico',
          name: 'Música para estudiar como un peripatético del siglo IV que acaba de ser instruido por Aristóteles',
          owner: 'Archivo Clásico',
          coverUrl: null,
          totalTracks: 5,
          tracks: DEMO_CITY_POP_TRACKS.slice(0, 5),
          tracksLoaded: true,
          sourceMode: 'audit-fixture',
        },
      ];
  }
}

export interface BreakUiFinding {
  id: number;
  severity: 'Mitigado' | 'Protegido';
  field: string;
  worstCaseValue: string;
  naiveFailure: string;
  defensiveFix: string;
}

export const BREAK_UI_AUDIT_FINDINGS: BreakUiFinding[] = [
  {
    id: 1,
    severity: 'Mitigado',
    field: 'playlist.name (120+ chars)',
    worstCaseValue:
      'Música para estudiar como un peripatético del siglo IV que acaba de ser instruido por Aristóteles...',
    naiveFailure:
      'Empuja el badge de conteo y el checkbox fuera de la tarjeta en pantallas de 320px.',
    defensiveFix:
      'min-w-0 en columna de texto + line-clamp-2 + overflow-wrap: anywhere + shrink-0 en controles laterales.',
  },
  {
    id: 2,
    severity: 'Mitigado',
    field: 'track.query (CJK + 14 artistas)',
    worstCaseValue:
      '植田能平 - あの日の出来事 / DJ Luian, Mambo Kingz... (240 chars)',
    naiveFailure:
      'Desborda horizontalmente la tabla de pistas o aplasta el badge de estado de migración.',
    defensiveFix:
      'grid/flex con min-w-0, truncate con atributo title completo y shrink-0 en badges de estado.',
  },
  {
    id: 3,
    severity: 'Mitigado',
    field: 'playlist.name vacío ("")',
    worstCaseValue: '"" (cadena vacía en playlists sin nombre de Spotify)',
    naiveFailure:
      'La fila colapsa su altura o falla la validación Pydantic min_length=1 en /api/ytm/prepare-playlist.',
    defensiveFix:
      'Fallback automático a "Playlist sin título" tanto en el cliente como antes de invocar prepare-playlist.',
  },
  {
    id: 4,
    severity: 'Protegido',
    field: 'Contadores y pluralización (0, 1, 1.284)',
    worstCaseValue: '1 pista vs 1.284 pistas + actualización en vivo 99% -> 100%',
    naiveFailure:
      '"1 pistas" mal pluralizado y vibración horizontal de columnas numéricas durante el progreso por lotes.',
    defensiveFix:
      'Intl.PluralRules("es-ES") + Intl.NumberFormat("es-ES") + font-variant-numeric: tabular-nums en todos los contadores.',
  },
  {
    id: 5,
    severity: 'Protegido',
    field: 'Colección de 1.284+ pistas',
    worstCaseValue: 'Liked Songs con 1.284 pistas sin paginación en el DOM',
    naiveFailure:
      'Renderizar 1.284 filas simultáneamente degrada el filtrado por teclado y el scroll.',
    defensiveFix:
      'Ventana de renderizado progresivo con corte automático (150 visibles + botón Cargar más) y filtrado instantáneo en 0ms.',
  },
];
