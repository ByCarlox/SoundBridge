import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  CloudArrowUp,
  GearSix,
  LinkSimple,
  ShieldCheck,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  checkServerHealth,
  getActiveApiBaseUrl,
  getDefaultApiBaseUrl,
  setCustomApiBaseUrl,
} from '../lib/api';
import { SoundBridgeLogo, SpotifyLogo, YouTubeMusicLogo } from './BrandLogos';

interface HeaderBarProps {
  spotifyConnected: boolean;
  spotifyModeLabel: string;
  ytmValidated: boolean;
  ytmBrowserLabel: string;
  onPurgeSession: () => void;
  onApiUrlChanged: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  spotifyConnected,
  spotifyModeLabel,
  ytmValidated,
  ytmBrowserLabel,
  onPurgeSession,
  onApiUrlChanged,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(getActiveApiBaseUrl());
  const [healthStatus, setHealthStatus] = useState<{
    checking: boolean;
    ok: boolean;
    latencyMs: number;
    error?: string;
  }>({
    checking: true,
    ok: false,
    latencyMs: 0,
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const runHealthCheck = async () => {
    setHealthStatus((prev) => ({ ...prev, checking: true }));
    const res = await checkServerHealth();
    setHealthStatus({
      checking: false,
      ok: res.ok,
      latencyMs: res.latencyMs,
      error: res.error,
    });
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  useEffect(() => {
    if (!popoverOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popoverOpen]);

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiBaseUrl(customUrlInput);
    onApiUrlChanged();
    runHealthCheck();
    setPopoverOpen(false);
  };

  const handleResetApiUrl = () => {
    setCustomUrlInput(getDefaultApiBaseUrl());
    setCustomApiBaseUrl('');
    onApiUrlChanged();
    runHealthCheck();
  };

  const activeBase = getActiveApiBaseUrl();

  return (
    <header className="sticky top-4 z-30 mx-auto w-full max-w-[1140px] px-4 sm:px-6">
      <div className="flex items-center justify-between gap-3 rounded-full border border-white/[0.09] bg-[#0D0E14]/85 px-4 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        {/* Brand Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#151722]">
            <SoundBridgeLogo size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-bold tracking-[-0.03em] text-[#F8FAFC]">
                SoundBridge
              </span>
              <span className="hidden items-center gap-1 rounded-full border border-[#1ED760]/30 bg-[#1ED760]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#1ED760] md:inline-flex">
                <ShieldCheck size={13} weight="fill" />
                <span>100% Privado</span>
              </span>
            </div>
            <p className="hidden truncate text-xs text-[#94A3B8] sm:block">
              Tu puente directo de Spotify a YouTube Music
            </p>
          </div>
        </div>

        {/* Live Brand Status Pills & Controls */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Spotify Status Pill */}
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium lg:flex ${
              spotifyConnected
                ? 'border-[#1ED760]/40 bg-[#1ED760]/12 text-[#F8FAFC]'
                : 'border-white/[0.08] bg-[#151722]/75 text-[#94A3B8]'
            }`}
          >
            <SpotifyLogo size={16} />
            <span className="whitespace-nowrap">{spotifyModeLabel}</span>
          </div>

          {/* YouTube Music Status Pill */}
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium lg:flex ${
              ytmValidated
                ? 'border-[#FF0033]/40 bg-[#FF0033]/12 text-[#F8FAFC]'
                : 'border-white/[0.08] bg-[#151722]/75 text-[#94A3B8]'
            }`}
          >
            <YouTubeMusicLogo size={16} />
            <span className="whitespace-nowrap">{ytmBrowserLabel}</span>
          </div>

          {/* Clear My Session Data Button */}
          {(spotifyConnected || ytmValidated) && (
            <button
              type="button"
              onClick={onPurgeSession}
              title="Borra al instante tus datos de esta sesión"
              className="btn-press flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#151722] px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:border-[#FF0033]/40 hover:text-[#F8FAFC]"
            >
              <Trash size={14} weight="bold" className="text-[#FF4D6D]" />
              <span className="hidden sm:inline whitespace-nowrap">Borrar mis datos</span>
            </button>
          )}

          {/* Discreet Advanced Settings Gear Popover */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setPopoverOpen((prev) => !prev)}
              aria-expanded={popoverOpen}
              aria-label="Estado del servicio y ajustes avanzados"
              className="btn-press flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#151722] px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:border-white/[0.18] hover:text-[#F8FAFC]"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  healthStatus.ok ? 'bg-[#1ED760]' : 'bg-[#FBBF24]'
                }`}
              />
              <GearSix size={15} weight="bold" />
              <span className="hidden md:inline whitespace-nowrap">Ajustes</span>
            </button>

            <AnimatePresence>
              {popoverOpen && (
                <motion.div
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, transform: 'scale(0.96) translateY(-4px)' }
                  }
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, transform: 'scale(1) translateY(0px)' }
                  }
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, transform: 'scale(0.96) translateY(-4px)' }
                  }
                  transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 mt-3 w-[340px] sm:w-[370px] rounded-3xl border border-white/[0.12] bg-[#0D0E14] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.85)] z-50"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#F8FAFC]">
                        Privacidad y Estado del Servicio
                      </h3>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">
                        100% Privado · No guardamos tus cuentas ni contraseñas en ningún servidor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPopoverOpen(false)}
                      className="btn-press rounded-full p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
                      aria-label="Cerrar ajustes"
                    >
                      <X size={15} weight="bold" />
                    </button>
                  </div>

                  {/* Service Status */}
                  <div className="mt-3 rounded-2xl border border-white/[0.07] bg-[#151722] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-[#F8FAFC]">
                        {healthStatus.ok ? (
                          <CheckCircle size={15} weight="fill" className="text-[#1ED760]" />
                        ) : (
                          <WarningCircle size={15} weight="fill" className="text-[#FBBF24]" />
                        )}
                        {healthStatus.checking
                          ? 'Comprobando conexión...'
                          : healthStatus.ok
                          ? 'Estado del Servicio: Conectado'
                          : 'Modo local / Sin servidor directo'}
                      </span>
                      <span className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                        {healthStatus.latencyMs} ms
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#94A3B8]">
                      <span>Servidor activo:</span>
                      <code className="rounded bg-[#060609] px-2 py-0.5 font-mono text-[#F8FAFC]">
                        {activeBase || 'Automático (/api)'}
                      </code>
                    </div>
                  </div>

                  <form onSubmit={handleSaveApiUrl} className="mt-3.5 space-y-3">
                    <div>
                      <label
                        htmlFor="custom-api-url"
                        className="block text-xs font-medium text-[#F8FAFC]"
                      >
                        Servidor personalizado (solo si usas GitHub Pages)
                      </label>
                      <div className="relative mt-1.5">
                        <LinkSimple
                          size={14}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                        />
                        <input
                          id="custom-api-url"
                          type="text"
                          value={customUrlInput}
                          onChange={(e) => setCustomUrlInput(e.target.value)}
                          placeholder="Automático (déjalo vacío salvo uso avanzado)"
                          className="w-full rounded-xl border border-white/[0.1] bg-[#060609] py-2 pl-8 pr-3 font-mono text-xs text-[#F8FAFC] placeholder-[#64748B] focus:border-[#1ED760] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleResetApiUrl}
                        className="btn-press rounded-full border border-white/[0.1] bg-[#151722] px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
                      >
                        Restablecer
                      </button>
                      <button
                        type="submit"
                        className="btn-press flex items-center gap-1.5 rounded-full bg-[#1ED760] px-4 py-1.5 text-xs font-semibold text-[#060609] hover:bg-[#3BE477]"
                      >
                        <CloudArrowUp size={14} weight="bold" />
                        <span>Guardar</span>
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 border-t border-white/[0.08] pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        onPurgeSession();
                        setPopoverOpen(false);
                      }}
                      className="btn-press flex w-full items-center justify-center gap-2 rounded-full border border-[#FF0033]/35 bg-[#FF0033]/12 py-2 text-xs font-semibold text-[#FF4D6D] hover:bg-[#FF0033]/20"
                    >
                      <Trash size={14} weight="bold" />
                      <span>Borrar mis datos de esta sesión</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
