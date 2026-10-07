import React, { useState, useEffect } from 'react';
import {
  ArrowSquareOut,
  CheckCircle,
  CursorClick,
  Info,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import type { BrowserKind } from '../types';
import { BrowserIcon } from './BrandLogos';

function detectUserBrowser(): BrowserKind {
  if (typeof navigator === 'undefined') return 'Chrome';
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (
    ua.includes('Safari/') &&
    !ua.includes('Chrome/') &&
    !ua.includes('Chromium/')
  ) {
    return 'Safari';
  }
  return 'Chrome';
}

interface BrowserInstruction {
  browser: BrowserKind;
  shortcutMac: string[];
  shortcutWin: string[];
  prereqNote?: string;
  copyMenuLabel: string;
  networkTabLabel: string;
}

const BROWSER_INSTRUCTIONS: Record<BrowserKind, BrowserInstruction> = {
  Safari: {
    browser: 'Safari',
    shortcutMac: ['Cmd ⌘', 'Opt ⌥', 'I'],
    shortcutWin: ['F12'],
    prereqNote:
      'En Safari: si aún no ves el Inspector, abre Ajustes (⌘ ,) → pestaña Avanzado → activa "Mostrar funciones para desarrolladores web".',
    copyMenuLabel: 'Copiar como cURL',
    networkTabLabel: 'Red (Network)',
  },
  Chrome: {
    browser: 'Chrome',
    shortcutMac: ['Cmd ⌘', 'Opt ⌥', 'I'],
    shortcutWin: ['Ctrl', 'Shift', 'I'],
    prereqNote:
      'En Windows, si ves dos opciones al hacer clic derecho, elige siempre "Copy as cURL (bash)".',
    copyMenuLabel: 'Copy → Copy as cURL',
    networkTabLabel: 'Network (Red)',
  },
  Firefox: {
    browser: 'Firefox',
    shortcutMac: ['Cmd ⌘', 'Opt ⌥', 'E'],
    shortcutWin: ['Ctrl', 'Shift', 'E'],
    copyMenuLabel: 'Copiar valor → Copiar como cURL',
    networkTabLabel: 'Red (Network)',
  },
  Edge: {
    browser: 'Edge',
    shortcutMac: ['Cmd ⌘', 'Opt ⌥', 'I'],
    shortcutWin: ['F12'],
    prereqNote:
      'En Windows, elige siempre "Copy as cURL (bash)" al hacer clic derecho sobre browse.',
    copyMenuLabel: 'Copy → Copy as cURL (bash)',
    networkTabLabel: 'Red (Network)',
  },
};

export const YtmTutorialPanel: React.FC = () => {
  const [selectedBrowser, setSelectedBrowser] = useState<BrowserKind>('Chrome');
  const [detectedBrowser, setDetectedBrowser] = useState<BrowserKind>('Chrome');

  useEffect(() => {
    const detected = detectUserBrowser();
    setDetectedBrowser(detected);
    setSelectedBrowser(detected);
  }, []);

  const current = BROWSER_INSTRUCTIONS[selectedBrowser];

  return (
    <div className="space-y-4">
      {/* Browser Selector Tabs with Recognizable Multi-Color Vector Logos */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium text-[#94A3B8]">
          Elige tu navegador para ver los 3 pasos exactos:
        </span>

        <div
          role="tablist"
          aria-label="Seleccionar navegador"
          className="flex flex-wrap items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#151722] p-1"
        >
          {(['Safari', 'Chrome', 'Firefox', 'Edge'] as BrowserKind[]).map(
            (browser) => {
              const active = selectedBrowser === browser;
              const isDetected = detectedBrowser === browser;
              return (
                <button
                  key={browser}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedBrowser(browser)}
                  className={`btn-press flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    active
                      ? 'bg-[#F8FAFC] text-[#060609] shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <BrowserIcon browser={browser} size={16} />
                  <span>{browser}</span>
                  {isDetected && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        active
                          ? 'bg-[#1ED760]/25 text-[#060609]'
                          : 'bg-white/[0.08] text-[#1ED760]'
                      }`}
                    >
                      Tu navegador
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Faux-OS Browser Window Card (Matching Panel 7 of the Brand Board) */}
      <div className="overflow-hidden rounded-3xl border border-white/[0.1] bg-[#11131C] shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
        {/* macOS Window Top Chrome */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#171A26] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#FF5F56]" />
            <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
            <span className="h-3 w-3 rounded-full bg-[#27C93F]" />
          </div>

          {/* Faux URL Bar */}
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="flex w-full max-w-md items-center justify-between gap-2 rounded-full border border-white/[0.08] bg-[#0D0E14] px-3.5 py-1 text-xs text-[#94A3B8]">
              <span className="truncate font-mono text-[11px] text-[#F8FAFC]">
                https://music.youtube.com
              </span>
              <span className="text-[10px] text-[#1ED760]">Sesión iniciada</span>
            </div>
          </div>

          <a
            href="https://music.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FF0033] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(255,0,51,0.35)] hover:bg-[#FF2A54]"
          >
            <span>1. Abrir YouTube Music</span>
            <ArrowSquareOut size={14} weight="bold" />
          </a>
        </div>

        {/* Window Interior: 3 Visual Steps */}
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          {/* Step A: Keystroke Shortcut */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-[#0D0E14] p-4">
            <div>
              <span className="inline-block rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#94A3B8]">
                CLIC 1 · EN YOUTUBE MUSIC
              </span>
              <h4 className="mt-2 text-sm font-semibold text-[#F8FAFC]">
                Abre el panel presionando estas teclas
              </h4>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Con YouTube Music abierto, pulsa en tu teclado:
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {current.shortcutMac.map((key, i) => (
                  <React.Fragment key={key}>
                    {i > 0 && <span className="text-xs text-[#64748B]">+</span>}
                    <kbd className="kbd-key">{key}</kbd>
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <span>En Windows / Linux:</span>
                {current.shortcutWin.map((key, i) => (
                  <React.Fragment key={key}>
                    {i > 0 && <span>+</span>}
                    <kbd className="rounded border border-white/[0.12] bg-[#171A26] px-1.5 py-0.5 font-mono text-[10px] text-[#F8FAFC]">
                      {key}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Step B: Filter by "browse" */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-[#0D0E14] p-4">
            <div>
              <span className="inline-block rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#94A3B8]">
                CLIC 2 · PESTAÑA {current.networkTabLabel.toUpperCase()}
              </span>
              <h4 className="mt-2 text-sm font-semibold text-[#F8FAFC]">
                Escribe "browse" en el buscador
              </h4>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Entra a la pestaña <strong className="text-[#F8FAFC]">{current.networkTabLabel}</strong>, escribe <code className="font-mono text-[#00E5FF]">browse</code> y haz clic en <strong className="text-[#F8FAFC]">Biblioteca</strong> en YouTube Music.
              </p>
            </div>

            {/* Visual Mini-Mock of Network Filter */}
            <div className="mt-4 rounded-xl border border-white/[0.1] bg-[#151722] p-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-[#00E5FF]/45 bg-[#060609] px-2.5 py-1.5">
                <MagnifyingGlass size={13} className="text-[#00E5FF]" />
                <span className="font-mono text-xs font-semibold text-[#F8FAFC]">
                  browse
                </span>
                <span className="ml-auto rounded bg-[#00E5FF]/15 px-1.5 py-0.5 font-mono text-[9px] text-[#00E5FF]">
                  Filtro
                </span>
              </div>
            </div>
          </div>

          {/* Step C: Right-click Copy as cURL */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-[#0D0E14] p-4">
            <div>
              <span className="inline-block rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#94A3B8]">
                CLIC 3 · COPIAR Y LISTO
              </span>
              <h4 className="mt-2 text-sm font-semibold text-[#F8FAFC]">
                Clic derecho en "browse" → Copiar cURL
              </h4>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Haz clic derecho sobre cualquier fila llamada <code className="font-mono text-[#F8FAFC]">browse</code> y elige:
              </p>
            </div>

            {/* Visual Mini-Mock of Context Menu */}
            <div className="mt-4 rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/12 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#1ED760]">
                <span className="truncate font-mono">{current.copyMenuLabel}</span>
                <CursorClick size={16} weight="fill" className="shrink-0" />
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-[#94A3B8]">
                <CheckCircle size={11} weight="fill" className="text-[#1ED760]" />
                <span>Luego solo pégalo abajo (se valida solo)</span>
              </div>
            </div>
          </div>
        </div>

        {current.prereqNote && (
          <div className="flex items-center gap-2 border-t border-white/[0.06] bg-[#0D0E14]/90 px-5 py-2.5 text-[11px] text-[#94A3B8]">
            <Info size={14} weight="fill" className="shrink-0 text-[#00E5FF]" />
            <span>{current.prereqNote}</span>
          </div>
        )}
      </div>
    </div>
  );
};
