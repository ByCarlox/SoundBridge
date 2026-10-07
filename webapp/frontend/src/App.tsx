import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowsClockwise,
  BookOpen,
  Check,
  CheckCircle,
  ClipboardText,
  Copy,
  FileCsv,
  FileJs,
  Key,
  LinkSimple,
  MagnifyingGlass,
  MusicNotes,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Sparkle,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Toaster, toast } from 'sonner';
import {
  PlaylistCoverArt,
  SonicWaveBridge,
  SoundBridgeLogo,
  SpotifyLogo,
  YouTubeMusicLogo,
} from './components/BrandLogos';
import { HeaderBar } from './components/HeaderBar';
import { SpotifyTutorialDrawer } from './components/SpotifyTutorialDrawer';
import { YtmTutorialPanel } from './components/YtmTutorialPanel';
import { HotReloadModal } from './components/HotReloadModal';
import { BreakUiToolbar } from './components/BreakUiToolbar';
import {
  fetchPublicSpotifyPlaylist,
  prepareYtmPlaylist,
  purgeAllSessionData,
  transferYtmBatch,
  validateYtmCredentials,
} from './lib/api';
import {
  clearSpotifySession,
  exchangeSpotifyPkceCodeIfPresent,
  fetchSpotifyLikedSongs,
  fetchSpotifyUserPlaylistsList,
  fetchSpotifyUserProfile,
  getCurrentRedirectUri,
  getSavedSpotifyClientId,
  getSavedSpotifyProfile,
  getSavedSpotifyToken,
  loadTracksForSpotifyPlaylist,
  saveSpotifyClientId,
  startSpotifyPkceLogin,
  type SpotifyUserProfile,
} from './lib/spotifyPkce';
import {
  formatDurationMs,
  formatNumber,
  formatPlaylistCount,
  formatTrackCount,
  getAuditDatasetPlaylists,
} from './lib/fixtures';
import type {
  AuditDatasetMode,
  MigrationLogEntry,
  PausedMigrationState,
  TrackTransferResult,
  UnifiedPlaylist,
  YTMValidateResponse,
} from './types';

const BATCH_SIZE = 5;
const INITIAL_VISIBLE_TRACKS = 150;

type WizardStep = 1 | 2 | 3;

export function App() {
  const shouldReduceMotion = useReducedMotion();

  // 3-Step Interactive Wizard State
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // Step 1: Spotify Connection State
  const [spotifyTab, setSpotifyTab] = useState<'public' | 'pkce'>('public');
  const [publicUrlInput, setPublicUrlInput] = useState('');
  const [loadingPublicPlaylist, setLoadingPublicPlaylist] = useState(false);

  const [spotifyClientId, setSpotifyClientId] = useState<string>(() =>
    getSavedSpotifyClientId()
  );
  const [spotifyToken, setSpotifyToken] = useState<string | null>(() =>
    getSavedSpotifyToken()
  );
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyUserProfile | null>(
    () => getSavedSpotifyProfile()
  );
  const [loadingSpotifyLibrary, setLoadingSpotifyLibrary] = useState(false);
  const [spotifyTutorialOpen, setSpotifyTutorialOpen] = useState(false);
  const [copiedRedirectInline, setCopiedRedirectInline] = useState(false);

  // Loaded Playlists & Track Preview State
  const [livePlaylists, setLivePlaylists] = useState<UnifiedPlaylist[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [activeInspectPlaylistId, setActiveInspectPlaylistId] = useState<string | null>(
    null
  );
  const [loadingPlaylistTracksId, setLoadingPlaylistTracksId] = useState<string | null>(
    null
  );
  const [showTracksPreview, setShowTracksPreview] = useState(false);

  // Instant 0ms Keyboard Filtering State
  const [playlistFilterQuery, setPlaylistFilterQuery] = useState('');
  const [trackFilterQuery, setTrackFilterQuery] = useState('');
  const [visibleTrackLimit, setVisibleTrackLimit] = useState(INITIAL_VISIBLE_TRACKS);

  // Step 2: YouTube Music Connection State
  const [ytmRawInput, setYtmRawInput] = useState('');
  const [validatingYtm, setValidatingYtm] = useState(false);
  const [ytmValidation, setYtmValidation] = useState<YTMValidateResponse | null>(null);
  const [ytmHeaders, setYtmHeaders] = useState<Record<string, string> | null>(null);

  // Step 3: Live Sonic Migration Deck State
  const [customTargetName, setCustomTargetName] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(false);
  const [lastCreatedYtmPlaylistId, setLastCreatedYtmPlaylistId] = useState<string>('');
  const [currentBatchNumber, setCurrentBatchNumber] = useState(0);
  const [totalBatchesCount, setTotalBatchesCount] = useState(0);
  const [activeMigratingPlaylistName, setActiveMigratingPlaylistName] = useState('');
  const [currentTransferringTrack, setCurrentTransferringTrack] = useState<string>('');
  const [migrationLogs, setMigrationLogs] = useState<MigrationLogEntry[]>([]);
  const [statsAttempted, setStatsAttempted] = useState(0);
  const [statsAdded, setStatsAdded] = useState(0);
  const [statsSkipped, setStatsSkipped] = useState(0);
  const [statsNotFound, setStatsNotFound] = useState(0);

  // Hot-Reload Modal State
  const [pausedMigration, setPausedMigration] = useState<PausedMigrationState | null>(
    null
  );
  const abortMigrationRef = useRef(false);

  // Dev-Only break-ui Audit State (Strictly gated by ?debug=1 or ?data=...)
  const [auditToolbarVisible, setAuditToolbarVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === '1' || params.get('data') !== null;
  });
  const [auditMode, setAuditMode] = useState<AuditDatasetMode>(() => {
    if (typeof window === 'undefined') return 'live';
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data') as AuditDatasetMode | null;
    if (
      dataParam &&
      ['live', 'demo', 'worst', 'empty', 'one', 'huge'].includes(dataParam)
    ) {
      return dataParam;
    }
    return 'live';
  });

  const displayedPlaylists = useMemo<UnifiedPlaylist[]>(() => {
    if (auditMode === 'live') {
      return livePlaylists;
    }
    return getAuditDatasetPlaylists(auditMode);
  }, [auditMode, livePlaylists]);

  useEffect(() => {
    if (displayedPlaylists.length === 0) {
      setSelectedPlaylistIds([]);
      setActiveInspectPlaylistId(null);
      return;
    }
    setSelectedPlaylistIds((prev) => {
      const valid = prev.filter((id) => displayedPlaylists.some((p) => p.id === id));
      if (valid.length > 0) return valid;
      return [displayedPlaylists[0].id];
    });
    setActiveInspectPlaylistId((prev) => {
      if (prev && displayedPlaylists.some((p) => p.id === prev)) return prev;
      return displayedPlaylists[0].id;
    });
  }, [displayedPlaylists]);

  useEffect(() => {
    setVisibleTrackLimit(INITIAL_VISIBLE_TRACKS);
  }, [activeInspectPlaylistId, trackFilterQuery]);

  // Handle Spotify PKCE Redirect Callback on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await exchangeSpotifyPkceCodeIfPresent();
      if (!mounted) return;
      if (result.error) {
        toast.error(result.error, { id: 'spotify-pkce-callback' });
        return;
      }
      if (result.exchanged && result.accessToken) {
        setSpotifyToken(result.accessToken);
        setSpotifyTab('pkce');
        const toastId = toast.loading(
          'Conectado con tu cuenta de Spotify. Cargando tus Canciones que te gustan y listas...',
          { id: 'spotify-pkce-sync' }
        );
        try {
          await syncFullSpotifyAccount(result.accessToken, toastId);
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : 'Error al cargar tu biblioteca de Spotify.',
            { id: toastId }
          );
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const syncFullSpotifyAccount = async (
    token: string,
    existingToastId?: string | number
  ) => {
    setLoadingSpotifyLibrary(true);
    const toastId =
      existingToastId ??
      toast.loading('Trayendo tus Canciones que te gustan y playlists de Spotify...');
    try {
      const profile = await fetchSpotifyUserProfile(token);
      setSpotifyProfile(profile);

      const [likedPlaylist, userPlaylists] = await Promise.all([
        fetchSpotifyLikedSongs(token),
        fetchSpotifyUserPlaylistsList(token),
      ]);

      const combined: UnifiedPlaylist[] = [likedPlaylist, ...userPlaylists];
      setLivePlaylists((prev) => {
        const publicOnes = prev.filter((p) => p.sourceMode === 'public-link');
        const deduplicatedPublic = publicOnes.filter(
          (pub) => !combined.some((c) => c.id === pub.id)
        );
        return [...combined, ...deduplicatedPublic];
      });
      setAuditMode('live');
      setSelectedPlaylistIds([likedPlaylist.id]);
      setActiveInspectPlaylistId(likedPlaylist.id);

      toast.success(
        `¡Biblioteca lista! ${formatTrackCount(
          likedPlaylist.totalTracks
        )} en tus Me Gusta y ${formatPlaylistCount(userPlaylists.length)}.`,
        { id: toastId }
      );
    } finally {
      setLoadingSpotifyLibrary(false);
    }
  };

  // Extract Public Playlist by Link
  const extractPublicPlaylistByUrl = async (urlOrId: string) => {
    const trimmed = urlOrId.trim();
    if (!trimmed) {
      toast.error('Pega el link de una playlist de Spotify primero.');
      return;
    }

    setLoadingPublicPlaylist(true);
    const toastId = toast.loading('Buscando tu playlist en Spotify...');
    try {
      const data = await fetchPublicSpotifyPlaylist(trimmed, spotifyToken);
      const safeName = (data.name || '').trim() || 'Playlist sin título';
      const newPlaylist: UnifiedPlaylist = {
        id: data.playlist_id,
        name: safeName,
        owner: data.owner || 'Spotify',
        coverUrl: data.cover_url,
        totalTracks: data.total_tracks || data.tracks.length,
        tracks: data.tracks,
        tracksLoaded: true,
        isPartialEmbed: data.is_partial_embed,
        sourceMode: 'public-link',
      };

      setLivePlaylists((prev) => {
        const filtered = prev.filter((p) => p.id !== newPlaylist.id);
        return [newPlaylist, ...filtered];
      });
      setAuditMode('live');
      setSelectedPlaylistIds([newPlaylist.id]);
      setActiveInspectPlaylistId(newPlaylist.id);

      if (data.is_partial_embed) {
        toast.warning(
          `Se cargaron las primeras ${formatTrackCount(
            data.tracks.length
          )} de "${safeName}". Para listas de más de 100 canciones, conecta tu cuenta de Spotify con un clic.`,
          { id: toastId, duration: 7000 }
        );
      } else {
        toast.success(
          `¡Lista "${safeName}" encontrada con ${formatTrackCount(
            data.tracks.length
          )}!`,
          { id: toastId }
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No pudimos abrir ese link de Spotify. Verifica que la playlist sea pública.',
        { id: toastId }
      );
    } finally {
      setLoadingPublicPlaylist(false);
    }
  };

  const handleExtractPublicPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    await extractPublicPlaylistByUrl(publicUrlInput);
  };

  // Load Built-in Sample Playlists in 1 Click
  const handleLoadSamplePlaylists = (specificSampleId?: string) => {
    const samples = getAuditDatasetPlaylists('demo');
    setLivePlaylists(samples);
    setAuditMode('live');
    if (specificSampleId) {
      const found = samples.find((s) => s.id === specificSampleId) || samples[0];
      setSelectedPlaylistIds([found.id]);
      setActiveInspectPlaylistId(found.id);
      toast.success(`Playlist "${found.name}" lista para mover a YouTube Music.`);
    } else {
      setSelectedPlaylistIds(samples.map((s) => s.id));
      setActiveInspectPlaylistId(samples[0].id);
      toast.success('Playlists de ejemplo cargadas. ¡Elige las que quieras mover!');
    }
  };

  const handleStartPkceAuth = async () => {
    try {
      await startSpotifyPkceLogin(spotifyClientId);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Ingresa tu Client ID de Spotify primero.'
      );
    }
  };

  const handleCopyRedirectUriInline = async () => {
    const uri = getCurrentRedirectUri();
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedRedirectInline(true);
      toast.success('Enlace de redirección copiado', {
        id: 'copy-redirect-inline',
        description: uri,
      });
      setTimeout(() => setCopiedRedirectInline(false), 2200);
    } catch {
      toast.error('No se pudo copiar automáticamente.');
    }
  };

  const handleInspectPlaylist = async (playlist: UnifiedPlaylist) => {
    setActiveInspectPlaylistId(playlist.id);
    if (
      playlist.sourceMode === 'pkce-oauth' &&
      !playlist.tracksLoaded &&
      spotifyToken
    ) {
      setLoadingPlaylistTracksId(playlist.id);
      const toastId = toast.loading(`Cargando canciones de "${playlist.name}"...`);
      try {
        const res = await loadTracksForSpotifyPlaylist(playlist, spotifyToken);
        setLivePlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id
              ? {
                  ...p,
                  tracks: res.tracks,
                  totalTracks: res.tracks.length || p.totalTracks,
                  tracksLoaded: true,
                  isPartialEmbed: res.isPartialEmbed,
                }
              : p
          )
        );
        toast.success(
          `${formatTrackCount(res.tracks.length)} listas en "${playlist.name}".`,
          { id: toastId }
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar las canciones de esta lista.',
          { id: toastId }
        );
      } finally {
        setLoadingPlaylistTracksId(null);
      }
    }
  };

  const togglePlaylistSelection = (playlistId: string) => {
    setSelectedPlaylistIds((prev) =>
      prev.includes(playlistId)
        ? prev.filter((id) => id !== playlistId)
        : [...prev, playlistId]
    );
  };

  // Step 2: Magic Auto-Validation for YouTube Music cURL
  const validateYtmRawString = async (rawText: string) => {
    const cleaned = rawText.trim();
    if (!cleaned) {
      toast.error('Pega primero el código cURL copiado desde YouTube Music.');
      return;
    }

    setValidatingYtm(true);
    const toastId = toast.loading('Conectando con tu cuenta de YouTube Music...', {
      id: 'ytm-validate-toast',
    });
    try {
      const res = await validateYtmCredentials(cleaned);
      setYtmValidation(res);
      if (res.valid) {
        setYtmHeaders(res.sanitized_headers);
        toast.success(
          `¡YouTube Music conectado! Encontramos ${formatPlaylistCount(
            res.playlist_count
          )} en tu cuenta.`,
          { id: toastId }
        );
      } else {
        setYtmHeaders(null);
        toast.error(
          res.message ||
            'No detectamos una sesión activa en ese código. Asegúrate de copiar como cURL desde browse.',
          { id: toastId }
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Error al conectar con el servidor de validación.',
        { id: toastId }
      );
    } finally {
      setValidatingYtm(false);
    }
  };

  const handlePasteFromClipboardButton = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        setYtmRawInput(clipText);
        await validateYtmRawString(clipText);
      } else {
        toast.error(
          'Tu portapapeles está vacío. Primero haz clic en "Copiar como cURL" en YouTube Music.'
        );
      }
    } catch {
      toast.info(
        'Haz clic dentro del recuadro y presiona Cmd+V (o Ctrl+V) para pegar.'
      );
    }
  };

  // Clear All Session Data
  const handlePurgeSession = () => {
    abortMigrationRef.current = true;
    purgeAllSessionData();
    clearSpotifySession();
    setSpotifyToken(null);
    setSpotifyProfile(null);
    setLivePlaylists([]);
    setSelectedPlaylistIds([]);
    setActiveInspectPlaylistId(null);
    setYtmRawInput('');
    setYtmValidation(null);
    setYtmHeaders(null);
    setPausedMigration(null);
    setIsMigrating(false);
    setMigrationCompleted(false);
    setMigrationLogs([]);
    setStatsAttempted(0);
    setStatsAdded(0);
    setStatsSkipped(0);
    setStatsNotFound(0);
    setAuditMode('live');
    setWizardStep(1);
    toast.success('Tus datos de esta sesión se han borrado por completo.', {
      id: 'purge-session-toast',
    });
  };

  // Instant 0ms Filtered Playlists & Tracks
  const filteredPlaylists = useMemo(() => {
    const q = playlistFilterQuery.trim().toLowerCase();
    if (!q) return displayedPlaylists;
    return displayedPlaylists.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q)
    );
  }, [displayedPlaylists, playlistFilterQuery]);

  const activeInspectedPlaylist = useMemo(() => {
    return (
      displayedPlaylists.find((p) => p.id === activeInspectPlaylistId) ||
      displayedPlaylists[0] ||
      null
    );
  }, [displayedPlaylists, activeInspectPlaylistId]);

  const filteredTracks = useMemo(() => {
    if (!activeInspectedPlaylist) return [];
    const q = trackFilterQuery.trim().toLowerCase();
    if (!q) return activeInspectedPlaylist.tracks;
    return activeInspectedPlaylist.tracks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.query.toLowerCase().includes(q)
    );
  }, [activeInspectedPlaylist, trackFilterQuery]);

  const selectedPlaylistsObjects = useMemo(() => {
    return displayedPlaylists.filter((p) => selectedPlaylistIds.includes(p.id));
  }, [displayedPlaylists, selectedPlaylistIds]);

  const totalSelectedTracksCount = useMemo(() => {
    return selectedPlaylistsObjects.reduce(
      (acc, p) => acc + (p.tracksLoaded ? p.tracks.length : p.totalTracks),
      0
    );
  }, [selectedPlaylistsObjects]);

  // Step 3: Execute Live Batch Migration
  const executeBatchMigration = async (options: {
    playlistIds: string[];
    startPlaylistIdx: number;
    startBatchIndex: number;
    activeHeaders: Record<string, string> | null;
    resumeYtmPlaylistId?: string;
    resumeExistingVideoIds?: string[];
    simulateMode?: boolean;
  }) => {
    const {
      playlistIds,
      startPlaylistIdx,
      startBatchIndex,
      activeHeaders,
      resumeYtmPlaylistId,
      resumeExistingVideoIds,
      simulateMode = false,
    } = options;

    abortMigrationRef.current = false;
    setIsMigrating(true);
    setMigrationCompleted(false);
    setPausedMigration(null);
    setWizardStep(3);

    let targetPlaylists = displayedPlaylists.filter((p) =>
      playlistIds.includes(p.id)
    );

    // If user jumped to simulation with 0 playlists loaded, load demo playlists automatically
    if (targetPlaylists.length === 0 && simulateMode) {
      const demoSet = getAuditDatasetPlaylists('demo');
      setLivePlaylists(demoSet);
      setSelectedPlaylistIds([demoSet[0].id]);
      setActiveInspectPlaylistId(demoSet[0].id);
      targetPlaylists = [demoSet[0]];
    }

    if (targetPlaylists.length === 0) {
      setIsMigrating(false);
      toast.error('Elige al menos una playlist en el Paso 1.');
      setWizardStep(1);
      return;
    }

    const toastId = toast.loading('Pasando tu música a YouTube Music...');

    try {
      for (let pIdx = startPlaylistIdx; pIdx < targetPlaylists.length; pIdx++) {
        if (abortMigrationRef.current) break;

        let playlist = targetPlaylists[pIdx];

        if (
          !playlist.tracksLoaded &&
          spotifyToken &&
          playlist.sourceMode === 'pkce-oauth'
        ) {
          const loaded = await loadTracksForSpotifyPlaylist(playlist, spotifyToken);
          playlist = {
            ...playlist,
            tracks: loaded.tracks,
            totalTracks: loaded.tracks.length,
            tracksLoaded: true,
          };
          setLivePlaylists((prev) =>
            prev.map((item) => (item.id === playlist.id ? playlist : item))
          );
        }

        const tracksToTransfer = playlist.tracks;
        const effectivePlaylistName =
          targetPlaylists.length === 1 && customTargetName.trim()
            ? customTargetName.trim()
            : (playlist.name || '').trim() || 'Playlist sin título';

        setActiveMigratingPlaylistName(effectivePlaylistName);

        if (tracksToTransfer.length === 0) {
          continue;
        }

        const totalBatches = Math.ceil(tracksToTransfer.length / BATCH_SIZE);
        setTotalBatchesCount(totalBatches);

        let ytmPlaylistId =
          pIdx === startPlaylistIdx && resumeYtmPlaylistId
            ? resumeYtmPlaylistId
            : '';
        let existingVideoIds =
          pIdx === startPlaylistIdx && resumeExistingVideoIds
            ? [...resumeExistingVideoIds]
            : [];

        if (!ytmPlaylistId) {
          if (simulateMode || !activeHeaders) {
            ytmPlaylistId = '';
            existingVideoIds = [];
          } else {
            try {
              const prep = await prepareYtmPlaylist(
                activeHeaders,
                effectivePlaylistName,
                `Transferida desde Spotify (${playlist.name}) con SoundBridge`
              );
              ytmPlaylistId = prep.ytm_playlist_id;
              setLastCreatedYtmPlaylistId(prep.ytm_playlist_id);
              existingVideoIds = prep.existing_video_ids || [];
            } catch (err) {
              if ((err as Error & { authExpired?: boolean }).authExpired) {
                setPausedMigration({
                  playlistIds,
                  currentPlaylistIdx: pIdx,
                  currentBatchStartIndex: 0,
                  ytmPlaylistId: '',
                  existingVideoIds: [],
                  reason: 'Tu sesión de YouTube Music expiró al crear la lista',
                });
                setIsMigrating(false);
                toast.error(
                  'Tu sesión de YouTube Music necesita renovarse para continuar.',
                  { id: toastId }
                );
                return;
              }
              throw err;
            }
          }
        }

        const initialBatchIdx = pIdx === startPlaylistIdx ? startBatchIndex : 0;

        for (
          let batchStart = initialBatchIdx;
          batchStart < tracksToTransfer.length;
          batchStart += BATCH_SIZE
        ) {
          if (abortMigrationRef.current) break;

          const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
          setCurrentBatchNumber(batchNumber);

          const slice = tracksToTransfer.slice(batchStart, batchStart + BATCH_SIZE);
          const queries = slice.map((t) => t.query);
          if (slice[0]) {
            setCurrentTransferringTrack(`${slice[0].artist} — ${slice[0].name}`);
          }

          let batchResponse: {
            results: TrackTransferResult[];
            added_count: number;
            skipped_count: number;
            not_found_count: number;
            auth_expired: boolean;
          };

          if (simulateMode || !activeHeaders) {
            await new Promise((r) => setTimeout(r, 380));
            const simResults: TrackTransferResult[] = queries.map((q, idx) => {
              const isSkip = idx === 3 && batchNumber === 1;
              return {
                query: q,
                status: isSkip ? 'already_present' : 'added',
                video_id: `ytm_${batchNumber}_${idx}`,
                matched_title: slice[idx]?.name || q,
                matched_artist: slice[idx]?.artist || 'Artista',
                message: isSkip
                  ? 'Ya estaba en tu biblioteca'
                  : '¡Agregada a tu playlist!',
              };
            });
            batchResponse = {
              results: simResults,
              added_count: simResults.filter((r) => r.status === 'added').length,
              skipped_count: simResults.filter(
                (r) => r.status === 'already_present'
              ).length,
              not_found_count: 0,
              auth_expired: false,
            };
          } else {
            batchResponse = await transferYtmBatch(
              activeHeaders,
              ytmPlaylistId,
              queries,
              existingVideoIds
            );
          }

          if (batchResponse.auth_expired) {
            setPausedMigration({
              playlistIds,
              currentPlaylistIdx: pIdx,
              currentBatchStartIndex: batchStart,
              ytmPlaylistId,
              existingVideoIds,
              reason: `Pausada en la parte ${batchNumber} de ${totalBatches}`,
            });
            setIsMigrating(false);
            toast.warning(
              `Tu sesión expiró en la parte ${batchNumber}/${totalBatches}. Pega un nuevo cURL para seguir sin perder nada.`,
              { id: toastId, duration: 8000 }
            );
            return;
          }

          for (const item of batchResponse.results) {
            if (item.video_id && !existingVideoIds.includes(item.video_id)) {
              existingVideoIds.push(item.video_id);
            }
          }

          const nowStr = new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          const newEntries: MigrationLogEntry[] = batchResponse.results.map(
            (r) => ({
              ...r,
              playlistId: playlist.id,
              playlistName: effectivePlaylistName,
              batchIndex: batchNumber,
              timestamp: nowStr,
            })
          );

          setMigrationLogs((prev) => [...newEntries, ...prev]);
          setStatsAttempted((prev) => prev + batchResponse.results.length);
          setStatsAdded((prev) => prev + batchResponse.added_count);
          setStatsSkipped((prev) => prev + batchResponse.skipped_count);
          setStatsNotFound((prev) => prev + batchResponse.not_found_count);
        }
      }

      if (abortMigrationRef.current) {
        toast.info('Transferencia en pausa.', { id: toastId });
      } else {
        setMigrationCompleted(true);
        toast.success('¡Listo! Tu música ya está en YouTube Music.', {
          id: toastId,
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Ocurrió un problema durante la transferencia.',
        { id: toastId }
      );
    } finally {
      setIsMigrating(false);
    }
  };

  const handleStartLiveOrSimulatedMigration = (forceSimulate = false) => {
    setMigrationLogs([]);
    setStatsAttempted(0);
    setStatsAdded(0);
    setStatsSkipped(0);
    setStatsNotFound(0);
    setCurrentBatchNumber(0);
    setMigrationCompleted(false);

    executeBatchMigration({
      playlistIds: selectedPlaylistIds,
      startPlaylistIdx: 0,
      startBatchIndex: 0,
      activeHeaders: forceSimulate ? null : ytmHeaders,
      simulateMode: forceSimulate || !ytmHeaders,
    });
  };

  const handleResumeAfterHotReload = (
    newHeaders: Record<string, string>,
    validation: YTMValidateResponse
  ) => {
    setYtmHeaders(newHeaders);
    setYtmValidation(validation);
    if (!pausedMigration) return;

    executeBatchMigration({
      playlistIds: pausedMigration.playlistIds,
      startPlaylistIdx: pausedMigration.currentPlaylistIdx,
      startBatchIndex: pausedMigration.currentBatchStartIndex,
      activeHeaders: newHeaders,
      resumeYtmPlaylistId: pausedMigration.ytmPlaylistId,
      resumeExistingVideoIds: pausedMigration.existingVideoIds,
      simulateMode: false,
    });
  };

  const handleSimulateHotReload = () => {
    const targetName =
      activeInspectedPlaylist?.name || 'Liked Songs from Spotify';
    setActiveMigratingPlaylistName(targetName);
    setCurrentBatchNumber(3);
    setTotalBatchesCount(12);
    setPausedMigration({
      playlistIds: selectedPlaylistIds.length
        ? selectedPlaylistIds
        : [activeInspectedPlaylist?.id || 'demo-liked-songs'],
      currentPlaylistIdx: 0,
      currentBatchStartIndex: 10,
      ytmPlaylistId: 'PL_HOT_RELOAD_TEST',
      existingVideoIds: [],
      reason: 'Simulación de renovación de sesión a mitad de lista',
    });
  };

  const handleDownloadReport = (format: 'json' | 'csv') => {
    if (migrationLogs.length === 0) return;
    const timestampSlug = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-');

    if (format === 'json') {
      const payload = {
        generated_at: new Date().toISOString(),
        stats: {
          attempted: statsAttempted,
          added: statsAdded,
          skipped_already_present: statsSkipped,
          not_found: statsNotFound,
        },
        tracks: migrationLogs,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soundbridge_resumen_${timestampSlug}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Resumen JSON descargado.');
    } else {
      const header = [
        'Hora',
        'Playlist',
        'Estado',
        'Cancion_Spotify',
        'YTM_Video_ID',
        'Coincidencia_YTM',
        'Detalle',
      ];
      const rows = migrationLogs.map((entry) =>
        [
          entry.timestamp,
          entry.playlistName,
          entry.status,
          entry.query,
          entry.video_id || '',
          entry.matched_title || '',
          entry.message || '',
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      );
      const csvContent = [header.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soundbridge_resumen_${timestampSlug}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Resumen CSV descargado.');
    }
  };

  const progressPercentage = useMemo(() => {
    if (migrationCompleted) return 100;
    if (totalBatchesCount <= 0) return 0;
    return Math.min(100, Math.round((currentBatchNumber / totalBatchesCount) * 100));
  }, [currentBatchNumber, totalBatchesCount, migrationCompleted]);

  // Circular SVG Ring Geometry (Panel 8 of Brand Board)
  const circleRadius = 58;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleStrokeOffset =
    circleCircumference - (progressPercentage / 100) * circleCircumference;

  // Header Status Labels
  const spotifyConnected = Boolean(spotifyToken || displayedPlaylists.length > 0);
  const spotifyModeLabel = spotifyToken
    ? spotifyProfile?.displayName || 'Spotify conectado'
    : displayedPlaylists.length > 0
    ? `${formatPlaylistCount(displayedPlaylists.length)} listas`
    : 'Elige tu música';

  const ytmValidated = Boolean(ytmValidation?.valid && ytmHeaders);
  const ytmBrowserLabel = ytmValidated
    ? `Conectado (${ytmValidation?.playlist_count ?? 0} listas)`
    : 'Sin conectar aún';

  const ytmDestinationUrl = lastCreatedYtmPlaylistId
    ? `https://music.youtube.com/playlist?list=${encodeURIComponent(
        lastCreatedYtmPlaylistId
      )}`
    : 'https://music.youtube.com/library/playlists';

  return (
    <div className="relative min-h-[100dvh] flex flex-col bg-[#060609] text-[#F8FAFC] overflow-x-hidden">
      {/* Ambient Concert Hall Dual-Glow Spotlights (Spotify Emerald Left + YouTube Music Crimson Right) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full opacity-20 blur-[130px]"
          style={{
            background:
              'radial-gradient(circle, rgba(30,215,96,0.85) 0%, rgba(30,215,96,0) 70%)',
          }}
        />
        <div
          className="absolute top-12 -right-32 h-[520px] w-[520px] rounded-full opacity-20 blur-[130px]"
          style={{
            background:
              'radial-gradient(circle, rgba(255,0,51,0.85) 0%, rgba(255,0,51,0) 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-[380px] w-[680px] -translate-x-1/2 rounded-full opacity-10 blur-[140px]"
          style={{
            background:
              'radial-gradient(circle, rgba(0,229,255,0.75) 0%, rgba(0,229,255,0) 70%)',
          }}
        />
      </div>

      {/* Single Root Sonner Toaster */}
      <Toaster
        position="bottom-right"
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: '#0D0E14',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#F8FAFC',
            fontFamily: 'var(--font-sans)',
            borderRadius: '1rem',
          },
        }}
      />

      {/* Floating Pill Navbar */}
      <HeaderBar
        spotifyConnected={spotifyConnected}
        spotifyModeLabel={spotifyModeLabel}
        ytmValidated={ytmValidated}
        ytmBrowserLabel={ytmBrowserLabel}
        onPurgeSession={handlePurgeSession}
        onApiUrlChanged={() => {
          toast.success('Servidor actualizado.');
        }}
      />

      {/* Main Interactive Wizard Stage */}
      <main
        id="main-workspace"
        className="relative z-10 mx-auto w-full max-w-[1080px] flex-1 px-4 pt-8 pb-24 sm:px-6"
      >
        {/* HERO SECTION & 3-STEP INTERACTIVE BRIDGE (Panel 4 & Panel 9 of Brand Kit) */}
        <section className="text-center">
          <h1 className="mx-auto max-w-2xl text-3xl sm:text-5xl font-bold tracking-[-0.035em] leading-[1.08] text-[#F8FAFC] text-balance">
            Tu música, sin fronteras.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-[#94A3B8] leading-relaxed">
            Pasa tus playlists y canciones favoritas de{' '}
            <span className="font-semibold text-[#1ED760]">Spotify</span> a{' '}
            <span className="font-semibold text-[#FF4D6D]">YouTube Music</span> en
            3 simples pasos.
          </p>

          {/* Interactive 3-Step Sonic Bridge Bar */}
          <nav
            aria-label="Pasos para transferir tu música"
            className="mx-auto mt-7 max-w-3xl rounded-full border border-white/[0.09] bg-[#0D0E14]/90 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <ol className="grid grid-cols-3 gap-1.5">
              {/* Step 1 Button */}
              <li>
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className={`btn-press flex w-full items-center justify-center gap-2.5 rounded-full px-3 py-2.5 text-xs sm:text-sm font-semibold ${
                    wizardStep === 1
                      ? 'bg-[#1ED760] text-[#060609] shadow-[0_0_24px_rgba(30,215,96,0.35)]'
                      : displayedPlaylists.length > 0
                      ? 'bg-[#1ED760]/12 text-[#F8FAFC] border border-[#1ED760]/35'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <SpotifyLogo size={20} />
                  <span className="truncate">1. Elige tu música</span>
                  {displayedPlaylists.length > 0 && wizardStep !== 1 && (
                    <CheckCircle
                      size={16}
                      weight="fill"
                      className="shrink-0 text-[#1ED760]"
                    />
                  )}
                </button>
              </li>

              {/* Step 2 Button */}
              <li>
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className={`btn-press flex w-full items-center justify-center gap-2.5 rounded-full px-3 py-2.5 text-xs sm:text-sm font-semibold ${
                    wizardStep === 2
                      ? 'bg-[#FF0033] text-white shadow-[0_0_24px_rgba(255,0,51,0.4)]'
                      : ytmValidated
                      ? 'bg-[#FF0033]/14 text-[#F8FAFC] border border-[#FF0033]/35'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <YouTubeMusicLogo size={20} />
                  <span className="truncate">2. Conecta YouTube Music</span>
                  {ytmValidated && wizardStep !== 2 && (
                    <CheckCircle
                      size={16}
                      weight="fill"
                      className="shrink-0 text-[#1ED760]"
                    />
                  )}
                </button>
              </li>

              {/* Step 3 Button */}
              <li>
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className={`btn-press flex w-full items-center justify-center gap-2.5 rounded-full px-3 py-2.5 text-xs sm:text-sm font-semibold ${
                    wizardStep === 3
                      ? 'bg-gradient-to-r from-[#1ED760] via-[#00E5FF] to-[#FF0033] text-[#060609] font-bold shadow-[0_0_25px_rgba(0,229,255,0.35)]'
                      : migrationCompleted
                      ? 'bg-white/[0.08] text-[#1ED760]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <SoundBridgeLogo size={22} />
                  <span className="truncate">3. ¡Transfiriendo!</span>
                </button>
              </li>
            </ol>
          </nav>
        </section>

        {/* ANIMATED WIZARD STAGE (1 Focused Step at a Time) */}
        <div className="mt-7">
          <AnimatePresence mode="wait">
            {/* =========================================================
                STEP 1: ELIGE TU MÚSICA DE SPOTIFY
               ========================================================= */}
            {wizardStep === 1 && (
              <motion.section
                key="wizard-step-1"
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: 'scale(0.98) translateY(10px)' }
                }
                animate={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, transform: 'scale(1) translateY(0px)' }
                }
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: 'scale(0.98) translateY(-8px)' }
                }
                transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                className="double-bezel-shell"
              >
                <div className="double-bezel-core p-5 sm:p-8">
                  {/* Step 1 Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-6">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#1ED760]/35 bg-[#1ED760]/12 shadow-[0_0_24px_rgba(30,215,96,0.2)]">
                        <SpotifyLogo size={30} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1ED760]">
                          Paso 1 de 3
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.025em] text-[#F8FAFC]">
                          ¿Qué música quieres mover hoy?
                        </h2>
                      </div>
                    </div>

                    {/* Friendly Mode Selector Pills */}
                    <div
                      role="tablist"
                      aria-label="Cómo elegir tu música de Spotify"
                      className="flex flex-wrap items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#151722] p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={spotifyTab === 'public'}
                        onClick={() => setSpotifyTab('public')}
                        className={`btn-press flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${
                          spotifyTab === 'public'
                            ? 'bg-[#1ED760] text-[#060609] shadow-xs'
                            : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        <LinkSimple size={14} weight="bold" />
                        <span>Pegar link de Playlist</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={spotifyTab === 'pkce'}
                        onClick={() => setSpotifyTab('pkce')}
                        className={`btn-press flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${
                          spotifyTab === 'pkce'
                            ? 'bg-[#1ED760] text-[#060609] shadow-xs'
                            : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        <SpotifyLogo size={15} />
                        <span>Conectar mi Spotify (Tus 'Me Gusta')</span>
                      </button>
                    </div>
                  </div>

                  {/* OPTION 1: PASTE PUBLIC LINK (Zero Login) */}
                  {spotifyTab === 'public' ? (
                    <div className="mt-6">
                      <form onSubmit={handleExtractPublicPlaylist}>
                        <label
                          htmlFor="spotify-public-url"
                          className="block text-sm font-medium text-[#F8FAFC]"
                        >
                          Pega el link de cualquier playlist pública de Spotify{' '}
                          <span className="text-xs font-normal text-[#94A3B8]">
                            (no necesitas iniciar sesión)
                          </span>
                        </label>

                        <div className="mt-2.5 flex flex-col gap-3 sm:flex-row">
                          <div className="relative flex-1 min-w-0">
                            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                              <SpotifyLogo size={20} />
                            </div>
                            <input
                              id="spotify-public-url"
                              type="text"
                              value={publicUrlInput}
                              onChange={(e) => setPublicUrlInput(e.target.value)}
                              placeholder="https://open.spotify.com/playlist/..."
                              className="w-full rounded-full border border-white/[0.12] bg-[#060609] py-3.5 pl-12 pr-4 text-sm text-[#F8FAFC] placeholder-[#64748B] focus:border-[#1ED760] focus:outline-none"
                            />
                          </div>

                          {/* Button-in-Button CTA */}
                          <button
                            type="submit"
                            disabled={loadingPublicPlaylist}
                            className="group btn-press flex shrink-0 items-center justify-center gap-3 rounded-full bg-[#1ED760] pl-6 pr-2.5 py-2 text-sm font-bold text-[#060609] shadow-[0_0_28px_rgba(30,215,96,0.3)] hover:bg-[#3BE477] disabled:opacity-50"
                          >
                            <span>
                              {loadingPublicPlaylist
                                ? 'Buscando playlist...'
                                : 'Buscar mi Playlist'}
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#060609]/15 transition-transform duration-150 group-hover:translate-x-0.5">
                              {loadingPublicPlaylist ? (
                                <ArrowsClockwise
                                  size={16}
                                  weight="bold"
                                  className="animate-spin"
                                />
                              ) : (
                                <ArrowRight size={16} weight="bold" />
                              )}
                            </span>
                          </button>
                        </div>
                      </form>

                      {/* 3 Clickable Visual Sample Playlists with Cover Art */}
                      <div className="mt-5 rounded-3xl border border-white/[0.07] bg-[#12141E]/80 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Sparkle
                              size={15}
                              weight="fill"
                              className="text-[#1ED760]"
                            />
                            <span className="text-xs sm:text-sm font-semibold text-[#F8FAFC]">
                              ¿Solo quieres probar cómo funciona? Elige una playlist de ejemplo en 1 clic:
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleLoadSamplePlaylists()}
                            className="btn-press rounded-full border border-[#1ED760]/40 bg-[#1ED760]/12 px-3 py-1 text-xs font-semibold text-[#1ED760] hover:bg-[#1ED760]/20"
                          >
                            Cargar las 3 de ejemplo
                          </button>
                        </div>

                        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {getAuditDatasetPlaylists('demo').map((sample, sIdx) => (
                            <button
                              key={sample.id}
                              type="button"
                              onClick={() => handleLoadSamplePlaylists(sample.id)}
                              className="group btn-press flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0D0E14] p-2.5 text-left hover:border-[#1ED760]/60 hover:bg-[#13181B]"
                            >
                              <PlaylistCoverArt
                                coverUrl={sample.coverUrl}
                                title={sample.name}
                                isLikedSongs={sample.isLikedSongs}
                                index={sIdx}
                                className="h-12 w-12 shrink-0 rounded-xl"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-[#F8FAFC] group-hover:text-[#1ED760]">
                                  {sample.name}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-[#94A3B8] tabular-nums">
                                  {formatTrackCount(sample.totalTracks)} · Probar
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* OPTION 2: CONNECT FULL SPOTIFY ACCOUNT (Liked Songs + All Playlists) */
                    <div className="mt-6 rounded-3xl border border-white/[0.08] bg-[#151722]/75 p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-xl">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1ED760]/15 px-3 py-1 text-xs font-semibold text-[#1ED760]">
                            <Sparkle size={13} weight="fill" />
                            <span>Incluye tus 'Canciones que te gustan' y listas de +100 canciones</span>
                          </span>
                          <h3 className="mt-2.5 text-base font-bold text-[#F8FAFC]">
                            Conecta tu biblioteca completa de Spotify
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                            Para traer tus favoritos y todas tus playlists privadas de golpe, pega tu <strong className="text-[#F8FAFC]">Client ID</strong> gratuito de Spotify. ¿No tienes uno? Nuestra guía visual te enseña a crearlo en 60 segundos.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSpotifyTutorialOpen(true)}
                          className="btn-press flex shrink-0 items-center gap-2 rounded-full border border-[#1ED760]/45 bg-[#1ED760]/15 px-4 py-2 text-xs font-bold text-[#1ED760] hover:bg-[#1ED760]/25"
                        >
                          <BookOpen size={15} weight="bold" />
                          <span>Ver guía paso a paso (60s)</span>
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-7">
                          <label
                            htmlFor="spotify-client-id-main"
                            className="block text-xs font-medium text-[#F8FAFC]"
                          >
                            Tu Client ID de Spotify
                          </label>
                          <div className="mt-1.5 flex gap-2">
                            <div className="relative min-w-0 flex-1">
                              <Key
                                size={15}
                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                              />
                              <input
                                id="spotify-client-id-main"
                                type="text"
                                value={spotifyClientId}
                                onChange={(e) => {
                                  setSpotifyClientId(e.target.value);
                                  saveSpotifyClientId(e.target.value);
                                }}
                                placeholder="Pega aquí tu Client ID de 32 caracteres..."
                                className="w-full rounded-full border border-white/[0.12] bg-[#060609] py-2.5 pl-10 pr-4 font-mono text-xs text-[#F8FAFC] placeholder-[#64748B] focus:border-[#1ED760] focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleStartPkceAuth}
                              className="btn-press flex shrink-0 items-center gap-2 rounded-full bg-[#1ED760] px-5 py-2.5 text-xs font-bold text-[#060609] hover:bg-[#3BE477]"
                            >
                              <SpotifyLogo size={16} />
                              <span>
                                {spotifyToken
                                  ? 'Reconectar cuenta'
                                  : 'Conectar mi Spotify'}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="sm:col-span-5">
                          <span className="block text-xs font-medium text-[#94A3B8]">
                            Enlace de redirección para tu app:
                          </span>
                          <div className="mt-1.5 flex items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded-full border border-white/[0.08] bg-[#060609] px-3 py-2 font-mono text-[11px] text-[#F8FAFC]">
                              {getCurrentRedirectUri()}
                            </code>
                            <button
                              type="button"
                              onClick={handleCopyRedirectUriInline}
                              className="btn-press flex shrink-0 items-center gap-1 rounded-full border border-white/[0.12] bg-[#0D0E14] px-3 py-2 text-xs font-semibold text-[#F8FAFC] hover:border-[#1ED760]"
                            >
                              {copiedRedirectInline ? (
                                <>
                                  <Check
                                    size={13}
                                    weight="bold"
                                    className="text-[#1ED760]"
                                  />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} weight="bold" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {spotifyToken && (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#1ED760]/35 bg-[#1ED760]/12 px-4 py-2.5 text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle
                              size={16}
                              weight="fill"
                              className="text-[#1ED760]"
                            />
                            <span className="text-[#F8FAFC]">
                              Cuenta conectada:{' '}
                              <strong>
                                {spotifyProfile?.displayName || 'Tu Spotify'}
                              </strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={loadingSpotifyLibrary}
                            onClick={() => syncFullSpotifyAccount(spotifyToken)}
                            className="btn-press flex items-center gap-1.5 rounded-full bg-[#060609] px-3 py-1 text-[11px] font-semibold text-[#1ED760]"
                          >
                            <ArrowsClockwise
                              size={12}
                              weight="bold"
                              className={loadingSpotifyLibrary ? 'animate-spin' : ''}
                            />
                            <span>Actualizar mis listas</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* =========================================================
                      ALBUM ART PLAYLIST GALLERY (Panel 6 of Brand Board)
                     ========================================================= */}
                  {displayedPlaylists.length > 0 && (
                    <div className="mt-8 border-t border-white/[0.08] pt-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-[#F8FAFC]">
                            Tus Playlists listas para mover
                          </h3>
                          <p className="text-xs text-[#94A3B8] tabular-nums">
                            Haz clic en las portadas que quieras llevar a YouTube Music ·{' '}
                            <strong className="text-[#1ED760]">
                              {formatPlaylistCount(selectedPlaylistIds.length)}{' '}
                              seleccionadas ({formatTrackCount(totalSelectedTracksCount)})
                            </strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Instant 0ms Search Filter */}
                          <div className="relative">
                            <MagnifyingGlass
                              size={14}
                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                            />
                            <input
                              type="search"
                              value={playlistFilterQuery}
                              onChange={(e) => setPlaylistFilterQuery(e.target.value)}
                              placeholder="Filtrar listas..."
                              aria-label="Filtrar playlists"
                              className="rounded-full border border-white/[0.1] bg-[#060609] py-1.5 pl-8 pr-3 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:border-[#1ED760] focus:outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPlaylistIds(
                                displayedPlaylists.map((p) => p.id)
                              )
                            }
                            className="btn-press rounded-full border border-white/[0.1] bg-[#151722] px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
                          >
                            Marcar todas
                          </button>
                        </div>
                      </div>

                      {/* Album Cover Cards Grid (Panel 6 Style) */}
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {filteredPlaylists.map((pl, idx) => {
                          const isSelected = selectedPlaylistIds.includes(pl.id);
                          const isInspected = activeInspectedPlaylist?.id === pl.id;
                          const safeTitle =
                            (pl.name || '').trim() || 'Playlist sin título';

                          return (
                            <div
                              key={pl.id}
                              onClick={() => {
                                togglePlaylistSelection(pl.id);
                                handleInspectPlaylist(pl);
                              }}
                              className={`group relative flex flex-col justify-between rounded-[1.5rem] border p-3.5 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 ${
                                isSelected
                                  ? 'border-[#1ED760] bg-[#13181B] ring-2 ring-[#1ED760]/60 shadow-[0_0_30px_rgba(30,215,96,0.18)]'
                                  : 'border-white/[0.08] bg-[#12141E] hover:border-white/[0.18]'
                              }`}
                            >
                              <div>
                                {/* Album Art Square / Squircle */}
                                <div className="relative h-36 w-full overflow-hidden rounded-2xl">
                                  <PlaylistCoverArt
                                    coverUrl={pl.coverUrl}
                                    title={safeTitle}
                                    isLikedSongs={pl.isLikedSongs}
                                    index={idx}
                                    className="h-full w-full"
                                  />

                                  {/* Selection Badge Top-Right */}
                                  <div
                                    className={`absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full transition-transform ${
                                      isSelected
                                        ? 'bg-[#1ED760] text-[#060609] shadow-md scale-100'
                                        : 'bg-black/55 text-white/80 border border-white/20'
                                    }`}
                                  >
                                    {isSelected ? (
                                      <Check size={15} weight="bold" />
                                    ) : (
                                      <Plus size={15} weight="bold" />
                                    )}
                                  </div>
                                </div>

                                {/* Defensive Title & Track Count */}
                                <div className="mt-3 min-w-0">
                                  <h4
                                    title={safeTitle}
                                    className="line-clamp-2 text-sm font-bold leading-snug text-[#F8FAFC] [overflow-wrap:anywhere]"
                                  >
                                    {safeTitle}
                                  </h4>
                                  <p
                                    className="mt-1 truncate text-xs text-[#94A3B8]"
                                    title={pl.owner}
                                  >
                                    {pl.owner}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-xs">
                                <span className="font-mono font-semibold text-[#1ED760] tabular-nums">
                                  {formatTrackCount(
                                    pl.tracksLoaded ? pl.tracks.length : pl.totalTracks
                                  )}
                                </span>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInspectPlaylist(pl);
                                    setShowTracksPreview((prev) =>
                                      isInspected ? !prev : true
                                    );
                                  }}
                                  className="text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] underline-offset-2 hover:underline"
                                >
                                  {isInspected && showTracksPreview
                                    ? 'Ocultar canciones'
                                    : 'Ver canciones'}
                                </button>
                              </div>

                              {pl.isPartialEmbed && (
                                <div className="mt-2 flex items-center justify-between gap-1 rounded-xl border border-[#FBBF24]/35 bg-[#FBBF24]/12 px-2.5 py-1 text-[10px] text-[#FBBF24]">
                                  <span className="flex items-center gap-1">
                                    <Warning size={12} weight="fill" />
                                    Primeras 100 pistas
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSpotifyTab('pkce');
                                      setSpotifyTutorialOpen(true);
                                    }}
                                    className="font-bold underline"
                                  >
                                    Traer todas
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Expandable Track Preview Drawer */}
                      {showTracksPreview && activeInspectedPlaylist && (
                        <div className="mt-5 rounded-3xl border border-white/[0.08] bg-[#090A10] p-4 sm:p-5">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-bold text-[#F8FAFC]">
                                Canciones en "{activeInspectedPlaylist.name}"
                              </h4>
                              <p className="text-xs text-[#94A3B8] tabular-nums">
                                Mostrando {formatNumber(filteredTracks.length)}{' '}
                                canciones
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <MagnifyingGlass
                                  size={13}
                                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                                />
                                <input
                                  type="search"
                                  value={trackFilterQuery}
                                  onChange={(e) =>
                                    setTrackFilterQuery(e.target.value)
                                  }
                                  placeholder="Buscar canción o artista..."
                                  className="rounded-full border border-white/[0.1] bg-[#151722] py-1 pl-8 pr-3 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:border-[#1ED760] focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowTracksPreview(false)}
                                className="rounded-full border border-white/[0.1] px-3 py-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
                              >
                                Cerrar vista
                              </button>
                            </div>
                          </div>

                          {loadingPlaylistTracksId === activeInspectedPlaylist.id ? (
                            <div className="mt-3 space-y-2 py-4">
                              {[1, 2, 3, 4].map((n) => (
                                <div
                                  key={n}
                                  className="h-9 w-full animate-pulse rounded-xl bg-[#151722]"
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-white/[0.05] pr-1">
                              {filteredTracks
                                .slice(0, visibleTrackLimit)
                                .map((track, idx) => (
                                  <div
                                    key={`${track.id}-${idx}`}
                                    className="flex items-center justify-between gap-3 py-2 text-xs"
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      <span className="w-6 shrink-0 text-right font-mono text-[11px] text-[#64748B] tabular-nums">
                                        {idx + 1}
                                      </span>
                                      <div className="min-w-0">
                                        <p
                                          title={track.name}
                                          className="truncate font-semibold text-[#F8FAFC]"
                                        >
                                          {track.name}
                                        </p>
                                        <p
                                          title={track.artist}
                                          className="truncate text-[11px] text-[#94A3B8]"
                                        >
                                          {track.artist}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="shrink-0 font-mono text-[11px] text-[#94A3B8] tabular-nums">
                                      {formatDurationMs(track.duration_ms)}
                                    </span>
                                  </div>
                                ))}

                              {filteredTracks.length > visibleTrackLimit && (
                                <div className="pt-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleTrackLimit((prev) => prev + 250)
                                    }
                                    className="btn-press rounded-full border border-white/[0.1] bg-[#151722] px-4 py-1.5 text-xs font-medium text-[#F8FAFC]"
                                  >
                                    Ver 250 canciones más (quedan{' '}
                                    {formatNumber(
                                      filteredTracks.length - visibleTrackLimit
                                    )}
                                    )
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Primary Step 1 -> Step 2 Action Bar */}
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#1ED760]/35 bg-gradient-to-r from-[#1ED760]/15 via-[#00E5FF]/10 to-transparent p-4 sm:px-6">
                        <div className="flex items-center gap-3 min-w-0">
                          <SpotifyLogo size={28} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#F8FAFC] tabular-nums">
                              {formatPlaylistCount(selectedPlaylistIds.length)}{' '}
                              listas para pasar ({formatTrackCount(totalSelectedTracksCount)})
                            </p>
                            <p className="text-xs text-[#94A3B8]">
                              Siguiente paso: conecta tu cuenta de YouTube Music
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={selectedPlaylistIds.length === 0}
                          onClick={() => setWizardStep(2)}
                          className="group btn-press flex items-center gap-3 rounded-full bg-[#1ED760] pl-6 pr-2.5 py-2.5 text-sm font-bold text-[#060609] shadow-[0_0_30px_rgba(30,215,96,0.4)] hover:bg-[#3BE477] disabled:opacity-45"
                        >
                          <span>Continuar a YouTube Music</span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#060609]/15 transition-transform duration-150 group-hover:translate-x-0.5">
                            <ArrowRight size={16} weight="bold" />
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>
            )}

            {/* =========================================================
                STEP 2: CONECTA TU YOUTUBE MUSIC (AUTO-PASTE & FAUX BROWSER)
               ========================================================= */}
            {wizardStep === 2 && (
              <motion.section
                key="wizard-step-2"
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: 'scale(0.98) translateY(10px)' }
                }
                animate={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, transform: 'scale(1) translateY(0px)' }
                }
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: 'scale(0.98) translateY(-8px)' }
                }
                transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                className="double-bezel-shell"
              >
                <div className="double-bezel-core p-5 sm:p-8">
                  {/* Step 2 Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#FF0033]/40 bg-[#FF0033]/12 shadow-[0_0_24px_rgba(255,0,51,0.25)]">
                        <YouTubeMusicLogo size={30} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#FF4D6D]">
                          Paso 2 de 3
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.025em] text-[#F8FAFC]">
                          Conecta tu YouTube Music en 3 clics
                        </h2>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="btn-press inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#151722] px-4 py-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC]"
                    >
                      <ArrowLeft size={14} weight="bold" />
                      <span>Volver a mis playlists</span>
                    </button>
                  </div>

                  {/* Faux-OS Browser Visual Guide with Browser Logos (Panel 7) */}
                  <div className="mt-6">
                    <YtmTutorialPanel />
                  </div>

                  {/* Magic Auto-Validating Paste Zone */}
                  <div className="mt-6 rounded-3xl border border-white/[0.1] bg-[#131520] p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <label
                          htmlFor="ytm-curl-textarea"
                          className="block text-sm font-bold text-[#F8FAFC]"
                        >
                          Pega aquí tu llave de conexión de YouTube Music
                        </label>
                        <p className="text-xs text-[#94A3B8]">
                          En cuanto presiones <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">Cmd+V</kbd> o{' '}
                          <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">Ctrl+V</kbd>, se validará automáticamente sin tocar nada más.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handlePasteFromClipboardButton}
                        className="btn-press flex items-center gap-2 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/12 px-4 py-2 text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/20"
                      >
                        <ClipboardText size={15} weight="bold" />
                        <span>Pegar desde mi portapapeles</span>
                      </button>
                    </div>

                    <div className="mt-3 relative">
                      <textarea
                        id="ytm-curl-textarea"
                        rows={3}
                        value={ytmRawInput}
                        onChange={(e) => setYtmRawInput(e.target.value)}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData('text');
                          if (pasted && pasted.trim().length > 15) {
                            setTimeout(() => validateYtmRawString(pasted), 60);
                          }
                        }}
                        placeholder="Haz clic aquí y presiona Cmd+V (Mac) o Ctrl+V (Windows) para pegar tu cURL..."
                        className="w-full rounded-2xl border border-white/[0.12] bg-[#060609] p-4 font-mono text-xs text-[#F8FAFC] placeholder-[#64748B] focus:border-[#00E5FF] focus:outline-none"
                      />
                    </div>

                    {/* Validation Diagnostics */}
                    {ytmValidation && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                            ytmValidation.valid
                              ? 'border-[#1ED760]/40 bg-[#1ED760]/14 text-[#1ED760]'
                              : 'border-[#FF0033]/40 bg-[#FF0033]/14 text-[#FF4D6D]'
                          }`}
                        >
                          {ytmValidation.valid ? (
                            <CheckCircle size={15} weight="fill" />
                          ) : (
                            <WarningCircle size={15} weight="fill" />
                          )}
                          <span>
                            {ytmValidation.valid
                              ? '¡Cuenta de YouTube Music conectada!'
                              : ytmValidation.message || 'Sesión no válida'}
                          </span>
                        </span>

                        {ytmValidation.valid && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#060609] px-3 py-1 text-xs font-medium text-[#F8FAFC] tabular-nums">
                            <YouTubeMusicLogo size={14} />
                            <span>
                              {formatPlaylistCount(ytmValidation.playlist_count)}{' '}
                              en tu biblioteca
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Footer: Start Real Transfer OR Try Simulation */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
                      <button
                        type="button"
                        onClick={() => handleStartLiveOrSimulatedMigration(true)}
                        className="btn-press inline-flex items-center gap-1.5 text-xs font-semibold text-[#00E5FF] hover:underline"
                      >
                        <Sparkle size={14} weight="fill" />
                        <span>Probar transferencia en modo simulación →</span>
                      </button>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {!ytmValidated && ytmRawInput.trim().length > 0 && (
                          <button
                            type="button"
                            disabled={validatingYtm}
                            onClick={() => validateYtmRawString(ytmRawInput)}
                            className="btn-press rounded-full border border-white/[0.15] bg-[#151722] px-4 py-2.5 text-xs font-semibold text-[#F8FAFC]"
                          >
                            {validatingYtm ? 'Verificando...' : 'Verificar conexión'}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={validatingYtm || (!ytmValidated && !ytmRawInput.trim())}
                          onClick={async () => {
                            if (!ytmValidated && ytmRawInput.trim()) {
                              await validateYtmRawString(ytmRawInput);
                            }
                            if (ytmHeaders) {
                              handleStartLiveOrSimulatedMigration(false);
                            }
                          }}
                          className="group btn-press flex items-center gap-3 rounded-full bg-gradient-to-r from-[#1ED760] via-[#00E5FF] to-[#FF0033] pl-6 pr-2.5 py-2.5 text-sm font-bold text-[#060609] shadow-[0_0_32px_rgba(0,229,255,0.35)] disabled:opacity-40"
                        >
                          <span>Pasar mi música a YouTube Music ahora</span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#060609]/20 text-white transition-transform duration-150 group-hover:translate-x-0.5">
                            <Play size={15} weight="fill" />
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}

            {/* =========================================================
                STEP 3: ¡TRANSFIRIENDO TU MÚSICA! (CIRCULAR RING & SONIC WAVE)
               ========================================================= */}
            {wizardStep === 3 && (
              <motion.section
                key="wizard-step-3"
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: 'scale(0.98) translateY(10px)' }
                }
                animate={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, transform: 'scale(1) translateY(0px)' }
                }
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: 'scale(0.98) translateY(-8px)' }
                }
                transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                className="double-bezel-shell"
              >
                <div className="double-bezel-core p-5 sm:p-8">
                  {/* Step 3 Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#00E5FF]">
                        Paso 3 de 3 · Puente Sonoro en Vivo
                      </span>
                      <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-[-0.025em] text-[#F8FAFC]">
                        {migrationCompleted
                          ? '¡Listo! Tu música ya está en YouTube Music'
                          : isMigrating
                          ? 'Moviendo tus canciones a YouTube Music...'
                          : 'Todo listo para iniciar la transferencia'}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMigrating ? (
                        <button
                          type="button"
                          onClick={() => {
                            abortMigrationRef.current = true;
                          }}
                          className="btn-press flex items-center gap-2 rounded-full border border-[#FF0033]/40 bg-[#FF0033]/15 px-4 py-2 text-xs font-bold text-[#FF4D6D]"
                        >
                          <Pause size={14} weight="fill" />
                          <span>Pausar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleStartLiveOrSimulatedMigration(!ytmHeaders)
                          }
                          className="btn-press flex items-center gap-2 rounded-full bg-[#1ED760] px-5 py-2 text-xs font-bold text-[#060609] shadow-[0_0_24px_rgba(30,215,96,0.35)]"
                        >
                          <Play size={14} weight="fill" />
                          <span>
                            {migrationCompleted
                              ? 'Volver a transferir'
                              : 'Iniciar ahora'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* VISUAL SONIC BRIDGE + CIRCULAR PROGRESS RING (Panel 4, 5 & 8 of Brand Board) */}
                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-center rounded-3xl border border-white/[0.08] bg-[#090A10] p-6">
                    {/* Left: Animated Sonic Wave Bridge between Spotify & YouTube Music */}
                    <div className="lg:col-span-7 flex flex-col items-center justify-center">
                      <div className="flex w-full items-center justify-between gap-3 sm:gap-5">
                        {/* Spotify Tile */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl border border-[#1ED760]/40 bg-[#1ED760]/12 shadow-[0_0_35px_rgba(30,215,96,0.25)]">
                            <SpotifyLogo size={42} />
                          </div>
                          <span className="text-xs font-semibold text-[#1ED760]">
                            Spotify
                          </span>
                        </div>

                        {/* Center Multi-Bar Sonic Equalizer Wave */}
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <SonicWaveBridge active={isMigrating} />
                        </div>

                        {/* YouTube Music Tile */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl border border-[#FF0033]/40 bg-[#FF0033]/12 shadow-[0_0_35px_rgba(255,0,51,0.28)]">
                            <YouTubeMusicLogo size={42} />
                          </div>
                          <span className="text-xs font-semibold text-[#FF4D6D]">
                            YouTube Music
                          </span>
                        </div>
                      </div>

                      {/* Now Playing / Crossing the Bridge Pill */}
                      <div className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#131520] px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <MusicNotes
                            size={18}
                            weight="fill"
                            className="shrink-0 text-[#00E5FF]"
                          />
                          <div className="min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                              {isMigrating
                                ? 'Cruzando el puente ahora'
                                : migrationCompleted
                                ? 'Playlist completada'
                                : 'Lista seleccionada'}
                            </span>
                            <p className="truncate text-xs sm:text-sm font-semibold text-[#F8FAFC]">
                              {currentTransferringTrack ||
                                activeMigratingPlaylistName ||
                                activeInspectedPlaylist?.name ||
                                'Liked Songs from Spotify'}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[11px] text-[#94A3B8] tabular-nums">
                          Evita duplicados
                        </span>
                      </div>
                    </div>

                    {/* Right: Circular Progress Ring (Panel 8 of Brand Board) */}
                    <div className="lg:col-span-5 flex flex-col items-center justify-center border-t border-white/[0.07] pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                      <div className="relative flex h-36 w-36 items-center justify-center">
                        <svg
                          className="h-full w-full -rotate-90"
                          viewBox="0 0 140 140"
                        >
                          <defs>
                            <linearGradient
                              id="ring-sonic-gradient"
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="100%"
                            >
                              <stop offset="0%" stopColor="#1ED760" />
                              <stop offset="55%" stopColor="#00E5FF" />
                              <stop offset="100%" stopColor="#FF0033" />
                            </linearGradient>
                          </defs>
                          <circle
                            cx="70"
                            cy="70"
                            r={circleRadius}
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="10"
                            fill="transparent"
                          />
                          <circle
                            cx="70"
                            cy="70"
                            r={circleRadius}
                            stroke="url(#ring-sonic-gradient)"
                            strokeWidth="10"
                            strokeLinecap="round"
                            fill="transparent"
                            strokeDasharray={circleCircumference}
                            strokeDashoffset={circleStrokeOffset}
                            style={{
                              transition:
                                'stroke-dashoffset 280ms var(--ease-out)',
                            }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="font-mono text-3xl font-bold tracking-tight text-[#F8FAFC] tabular-nums">
                            {progressPercentage}%
                          </span>
                          <span className="text-[11px] font-medium text-[#94A3B8]">
                            Completado
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3 Friendly Consumer Scorecards */}
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#1ED760]/30 bg-[#1ED760]/10 p-4">
                      <span className="block text-xs font-medium text-[#1ED760]">
                        Canciones pasadas con éxito
                      </span>
                      <span className="mt-1 block font-mono text-2xl font-bold text-[#F8FAFC] tabular-nums">
                        {formatNumber(statsAdded)}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 p-4">
                      <span className="block text-xs font-medium text-[#FBBF24]">
                        Ya estaban en tu biblioteca
                      </span>
                      <span className="mt-1 block font-mono text-2xl font-bold text-[#F8FAFC] tabular-nums">
                        {formatNumber(statsSkipped)}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-[#FF0033]/30 bg-[#FF0033]/10 p-4">
                      <span className="block text-xs font-medium text-[#FF4D6D]">
                        No encontradas
                      </span>
                      <span className="mt-1 block font-mono text-2xl font-bold text-[#F8FAFC] tabular-nums">
                        {formatNumber(statsNotFound)}
                      </span>
                    </div>
                  </div>

                  {/* Celebration Banner on Completion */}
                  {migrationCompleted && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#FF0033]/40 bg-gradient-to-r from-[#FF0033]/18 via-[#00E5FF]/10 to-[#1ED760]/15 p-5 sm:px-6">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <YouTubeMusicLogo size={36} />
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-[#F8FAFC]">
                            ¡Tu playlist "{activeMigratingPlaylistName}" está lista!
                          </h3>
                          <p className="text-xs text-[#94A3B8]">
                            Ábrela directamente en YouTube Music o descarga el resumen de tus canciones.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <a
                          href={ytmDestinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group btn-press inline-flex items-center gap-3 rounded-full bg-[#FF0033] pl-5 pr-2.5 py-2 text-xs sm:text-sm font-bold text-white shadow-[0_0_28px_rgba(255,0,51,0.45)] hover:bg-[#FF2A54]"
                        >
                          <YouTubeMusicLogo size={18} />
                          <span>Abrir mi Playlist en YouTube Music</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/25">
                            <ArrowUpRight size={15} weight="bold" />
                          </span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDownloadReport('csv')}
                          className="btn-press inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#151722] px-3.5 py-2 text-xs font-semibold text-[#F8FAFC]"
                        >
                          <FileCsv size={15} weight="bold" className="text-[#1ED760]" />
                          <span>Descargar CSV</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadReport('json')}
                          className="btn-press inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#151722] px-3.5 py-2 text-xs font-semibold text-[#F8FAFC]"
                        >
                          <FileJs size={15} weight="bold" className="text-[#00E5FF]" />
                          <span>JSON</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Live Track Feed */}
                  {migrationLogs.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2.5">
                        <span className="font-semibold text-[#F8FAFC]">
                          Canciones procesadas en tiempo real
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatTrackCount(migrationLogs.length)}
                        </span>
                      </div>

                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {migrationLogs.map((log, idx) => (
                          <div
                            key={`${log.query}-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#131520] px-4 py-2.5 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p
                                title={log.query}
                                className="truncate font-semibold text-[#F8FAFC]"
                              >
                                {log.query}
                              </p>
                              <p className="truncate text-[11px] text-[#94A3B8]">
                                {log.matched_title
                                  ? `Encontrada en YouTube Music: ${log.matched_title}`
                                  : log.message}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full border px-3 py-1 font-semibold text-[11px] whitespace-nowrap ${
                                log.status === 'added'
                                  ? 'border-[#1ED760]/40 bg-[#1ED760]/14 text-[#1ED760]'
                                  : log.status === 'already_present'
                                  ? 'border-[#FBBF24]/40 bg-[#FBBF24]/14 text-[#FBBF24]'
                                  : 'border-[#FF0033]/40 bg-[#FF0033]/14 text-[#FF4D6D]'
                              }`}
                            >
                              {log.status === 'added'
                                ? '¡Agregada!'
                                : log.status === 'already_present'
                                ? 'Ya estaba'
                                : 'No encontrada'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Trust Strip */}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-6 text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} weight="fill" className="text-[#1ED760]" />
            <span>
              SoundBridge · 100% Privado · Tus cuentas y llaves nunca se guardan en ningún servidor.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleLoadSamplePlaylists()}
              className="hover:text-[#F8FAFC] transition-colors"
            >
              Cargar playlists de ejemplo
            </button>
          </div>
        </footer>
      </main>

      {/* Friendly 3-Step Spotify Drawer */}
      <SpotifyTutorialDrawer
        open={spotifyTutorialOpen}
        onClose={() => setSpotifyTutorialOpen(false)}
        clientId={spotifyClientId}
        onClientIdChange={(val) => {
          setSpotifyClientId(val);
          saveSpotifyClientId(val);
        }}
        onStartPkceAuth={handleStartPkceAuth}
      />

      {/* Hot-Reload Modal on Session Expiry */}
      <HotReloadModal
        open={Boolean(pausedMigration)}
        playlistName={activeMigratingPlaylistName || 'Tu playlist'}
        batchNumber={
          pausedMigration
            ? Math.floor(pausedMigration.currentBatchStartIndex / BATCH_SIZE) + 1
            : currentBatchNumber
        }
        totalBatches={totalBatchesCount || 1}
        onCancelMigration={() => {
          setPausedMigration(null);
          setIsMigrating(false);
        }}
        onResumeWithNewHeaders={handleResumeAfterHotReload}
      />

      {/* Strictly Hidden unless ?debug=1 or ?data=... */}
      <BreakUiToolbar
        visible={auditToolbarVisible}
        onToggleVisible={() => setAuditToolbarVisible((prev) => !prev)}
        activeMode={auditMode}
        onSelectMode={(mode) => setAuditMode(mode)}
        onSimulateHotReload={handleSimulateHotReload}
      />
    </div>
  );
}

export default App;
