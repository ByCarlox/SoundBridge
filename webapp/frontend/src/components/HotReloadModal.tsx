import React, { useState } from 'react';
import {
  ArrowsClockwise,
  CheckCircle,
  ClipboardText,
  Play,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { validateYtmCredentials } from '../lib/api';
import type { YTMValidateResponse } from '../types';
import { YouTubeMusicLogo } from './BrandLogos';

interface HotReloadModalProps {
  open: boolean;
  playlistName: string;
  batchNumber: number;
  totalBatches: number;
  onCancelMigration: () => void;
  onResumeWithNewHeaders: (
    newHeaders: Record<string, string>,
    validation: YTMValidateResponse
  ) => void;
}

export const HotReloadModal: React.FC<HotReloadModalProps> = ({
  open,
  playlistName,
  batchNumber,
  totalBatches,
  onCancelMigration,
  onResumeWithNewHeaders,
}) => {
  const [freshCurl, setFreshCurl] = useState('');
  const [validating, setValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const runValidation = async (rawText: string) => {
    if (!rawText.trim()) {
      setErrorMsg('Pega la nueva llave de conexión desde music.youtube.com.');
      return;
    }

    setValidating(true);
    setErrorMsg(null);
    const toastId = toast.loading('Renovando conexión con YouTube Music...');

    try {
      const res = await validateYtmCredentials(rawText);
      if (!res.valid) {
        const msg =
          res.message ||
          'El código pegado no contiene una sesión activa de YouTube Music.';
        setErrorMsg(msg);
        toast.error(msg, { id: toastId });
        setValidating(false);
        return;
      }

      toast.success('¡Conexión renovada! Continuando donde nos quedamos.', {
        id: toastId,
      });
      setFreshCurl('');
      setValidating(false);
      onResumeWithNewHeaders(res.sanitized_headers, res);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error al validar la nueva conexión.';
      setErrorMsg(msg);
      toast.error(msg, { id: toastId });
      setValidating(false);
    }
  };

  const handleValidateAndResume = async (e: React.FormEvent) => {
    e.preventDefault();
    await runValidation(freshCurl);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setFreshCurl(text);
        await runValidation(text);
      } else {
        toast.error('Tu portapapeles está vacío.');
      }
    } catch {
      toast.error('Pega directamente en el recuadro con Cmd+V o Ctrl+V.');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hot-reload-modal-title"
        >
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs"
          />

          {/* Modal Box */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, transform: 'scale(0.96) translateY(8px)' }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, transform: 'scale(1) translateY(0px)' }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, transform: 'scale(0.96) translateY(8px)' }
            }
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className="relative z-10 w-full max-w-lg rounded-3xl border border-[#FF0033]/40 bg-[#0D0E14] p-6 text-[#F8FAFC] shadow-[0_24px_70px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <YouTubeMusicLogo size={36} />
                <div>
                  <span className="inline-block font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#FF4D6D] tabular-nums">
                    Transferencia en pausa · Parte {batchNumber} de {totalBatches}
                  </span>
                  <h2
                    id="hot-reload-modal-title"
                    className="text-base font-bold tracking-[-0.02em] text-[#F8FAFC]"
                  >
                    Tu sesión de YouTube Music necesita refrescarse
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onCancelMigration}
                className="btn-press rounded-full border border-white/[0.1] bg-[#151722] p-1.5 text-[#94A3B8] hover:text-[#F8FAFC]"
                aria-label="Cerrar ventana"
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#94A3B8]">
              Tus canciones anteriores de{' '}
              <strong className="font-semibold text-[#F8FAFC]">{playlistName}</strong>{' '}
              ya están a salvo en tu cuenta. Copia un nuevo <code className="font-mono text-[#F8FAFC]">cURL</code> desde YouTube Music y pégalo aquí para seguir justo donde quedó.
            </p>

            <form onSubmit={handleValidateAndResume} className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="hot-reload-curl-input"
                  className="text-xs font-medium text-[#F8FAFC]"
                >
                  Pega aquí tu nueva conexión (se valida al instante)
                </label>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="btn-press inline-flex items-center gap-1 rounded-full border border-[#1ED760]/40 bg-[#1ED760]/12 px-2.5 py-1 text-[11px] font-semibold text-[#1ED760] hover:bg-[#1ED760]/20"
                >
                  <ClipboardText size={13} weight="bold" />
                  <span>Pegar del portapapeles</span>
                </button>
              </div>

              <textarea
                id="hot-reload-curl-input"
                rows={4}
                value={freshCurl}
                onChange={(e) => setFreshCurl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted && pasted.trim().length > 20) {
                    setTimeout(() => runValidation(pasted), 60);
                  }
                }}
                placeholder="Haz clic aquí y presiona Cmd+V o Ctrl+V..."
                className="w-full rounded-2xl border border-white/[0.12] bg-[#060609] p-3 font-mono text-xs text-[#F8FAFC] placeholder-[#64748B] focus:border-[#1ED760] focus:outline-none"
              />

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-2xl border border-[#FF0033]/40 bg-[#FF0033]/12 p-3 text-xs text-[#FF4D6D]">
                  <WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCancelMigration}
                  className="btn-press rounded-full border border-white/[0.1] bg-[#151722] px-4 py-2 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  Pausar por ahora
                </button>
                <button
                  type="submit"
                  disabled={validating}
                  className="btn-press flex items-center gap-2 rounded-full bg-[#1ED760] px-5 py-2 text-xs font-bold text-[#060609] hover:bg-[#3BE477] disabled:opacity-50"
                >
                  {validating ? (
                    <>
                      <ArrowsClockwise size={15} weight="bold" className="animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} weight="fill" />
                      <span>Continuar transferencia</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-4 flex items-center gap-2 border-t border-white/[0.08] pt-3 text-[11px] text-[#94A3B8]">
              <CheckCircle size={14} weight="fill" className="shrink-0 text-[#1ED760]" />
              <span>
                Evita canciones duplicadas automáticamente al continuar.
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
