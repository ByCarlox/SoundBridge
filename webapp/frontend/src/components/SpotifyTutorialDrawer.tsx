import React, { useState, useEffect } from 'react';
import {
  ArrowSquareOut,
  Check,
  Copy,
  Key,
  ShieldCheck,
  X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { getCurrentRedirectUri } from '../lib/spotifyPkce';
import { SpotifyLogo } from './BrandLogos';

interface SpotifyTutorialDrawerProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onClientIdChange: (value: string) => void;
  onStartPkceAuth: () => void;
}

export const SpotifyTutorialDrawer: React.FC<SpotifyTutorialDrawerProps> = ({
  open,
  onClose,
  clientId,
  onClientIdChange,
  onStartPkceAuth,
}) => {
  const [copiedUri, setCopiedUri] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const redirectUri = getCurrentRedirectUri();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopiedUri(true);
      toast.success('Enlace de redirección copiado', {
        id: 'copy-redirect-uri',
        description: redirectUri,
      });
      setTimeout(() => setCopiedUri(false), 2400);
    } catch {
      toast.error('No se pudo copiar automáticamente. Cópialo manualmente.', {
        id: 'copy-redirect-uri',
      });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spotify-tutorial-title"
        >
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
          />

          {/* Slide-over Panel */}
          <motion.aside
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, transform: 'translateX(100%)' }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, transform: 'translateX(0%)' }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, transform: 'translateX(100%)' }
            }
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-white/[0.1] bg-[#0D0E14] text-[#F8FAFC] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#1ED760]/35 bg-[#1ED760]/12 px-3 py-1 text-xs font-semibold text-[#1ED760]">
                  <SpotifyLogo size={16} />
                  <span>Guía rápida de 60 segundos</span>
                </div>
                <h2
                  id="spotify-tutorial-title"
                  className="mt-2.5 text-lg font-bold tracking-[-0.02em] text-[#F8FAFC]"
                >
                  Conecta tu cuenta de Spotify para traer tus 'Me Gusta' y todas tus listas
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                  Para leer tus <strong className="font-medium text-[#F8FAFC]">Canciones que te gustan</strong> y listas grandes (+100 canciones) directamente en tu navegador, crea una llave personal gratuita en Spotify en 3 pasos:
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-press shrink-0 rounded-full border border-white/[0.1] bg-[#151722] p-2 text-[#94A3B8] hover:text-[#F8FAFC]"
                aria-label="Cerrar guía de Spotify"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Steps Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {/* Step 1 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#151722]/85 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1ED760] font-mono text-xs font-bold text-[#060609] tabular-nums">
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[#F8FAFC]">
                      Abre Spotify Dashboard y pulsa "Create app"
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                      Entra con tu cuenta normal de Spotify y haz clic en el botón <strong className="text-[#F8FAFC]">Create app</strong>.
                    </p>
                    <a
                      href="https://developer.spotify.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-press mt-3 inline-flex items-center gap-2 rounded-full border border-[#1ED760]/40 bg-[#1ED760]/12 px-4 py-1.5 text-xs font-semibold text-[#1ED760] hover:bg-[#1ED760]/20"
                    >
                      <span>Abrir developer.spotify.com/dashboard</span>
                      <ArrowSquareOut size={14} weight="bold" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#151722]/85 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1ED760] font-mono text-xs font-bold text-[#060609] tabular-nums">
                    2
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[#F8FAFC]">
                      Pega este enlace en "Redirect URIs"
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                      Ponle cualquier nombre (por ejemplo <code className="font-mono text-[#F8FAFC]">SoundBridge</code>) y en la casilla <strong className="text-[#F8FAFC]">Redirect URIs</strong> pega esta dirección exacta y pulsa <strong className="text-[#F8FAFC]">Add</strong>:
                    </p>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-[#060609] px-3 py-2 font-mono text-xs text-[#F8FAFC] overflow-x-auto">
                        <span className="break-all">{redirectUri}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyRedirectUri}
                        className="btn-press flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#1ED760] px-4 py-2 text-xs font-bold text-[#060609] hover:bg-[#3BE477]"
                      >
                        {copiedUri ? (
                          <>
                            <Check size={14} weight="bold" />
                            <span>Enlace copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} weight="bold" />
                            <span>Copiar enlace de redirección</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="mt-2.5 text-[11px] text-[#94A3B8]">
                      Marca la casilla <strong className="text-[#F8FAFC]">Web API</strong> más abajo y pulsa <strong className="text-[#F8FAFC]">Save</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#151722]/85 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1ED760] font-mono text-xs font-bold text-[#060609] tabular-nums">
                    3
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[#F8FAFC]">
                      Copia tu "Client ID" y pégalo aquí
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                      Dentro de tu app en Spotify, haz clic en <strong className="text-[#F8FAFC]">Settings</strong>, copia el código llamado <strong className="text-[#F8FAFC]">Client ID</strong> y pégalo debajo:
                    </p>

                    <div className="mt-3 relative">
                      <Key
                        size={15}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                      />
                      <input
                        id="drawer-spotify-client-id"
                        type="text"
                        value={clientId}
                        onChange={(e) => onClientIdChange(e.target.value)}
                        placeholder="Pega aquí tu Client ID de Spotify..."
                        className="w-full rounded-xl border border-white/[0.12] bg-[#060609] py-2.5 pl-10 pr-3 font-mono text-xs text-[#F8FAFC] placeholder-[#64748B] focus:border-[#1ED760] focus:outline-none"
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-[11px] text-[#1ED760]">
                      <ShieldCheck size={15} weight="fill" className="shrink-0" />
                      <span>
                        100% Seguro: nunca necesitas ni te pediremos tu clave secreta (Client Secret).
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] bg-[#090A0F] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-press rounded-full border border-white/[0.1] bg-[#151722] px-4 py-2 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!clientId.trim()}
                onClick={() => {
                  onClose();
                  onStartPkceAuth();
                }}
                className="btn-press flex items-center gap-2 rounded-full bg-[#1ED760] px-5 py-2.5 text-xs font-bold text-[#060609] shadow-[0_0_24px_rgba(30,215,96,0.3)] hover:bg-[#3BE477] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <SpotifyLogo size={16} />
                <span>Conectar mi Spotify ahora</span>
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
