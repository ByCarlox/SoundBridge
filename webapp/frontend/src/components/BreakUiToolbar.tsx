import React, { useState } from 'react';
import {
  Bug,
  CaretDown,
  CaretUp,
  CheckCircle,
  Lightning,
  ShieldCheck,
} from '@phosphor-icons/react';
import { BREAK_UI_AUDIT_FINDINGS } from '../lib/fixtures';
import type { AuditDatasetMode } from '../types';

interface BreakUiToolbarProps {
  visible: boolean;
  onToggleVisible: () => void;
  activeMode: AuditDatasetMode;
  onSelectMode: (mode: AuditDatasetMode) => void;
  onSimulateHotReload: () => void;
}

const SEGMENTS: Array<{ id: AuditDatasetMode; label: string }> = [
  { id: 'live', label: 'En Vivo' },
  { id: 'demo', label: 'Demo' },
  { id: 'worst', label: 'Worst Case' },
  { id: 'empty', label: 'Vacío (0)' },
  { id: 'one', label: '1 ítem' },
  { id: 'huge', label: '1.000+ pistas' },
];

export const BreakUiToolbar: React.FC<BreakUiToolbarProps> = ({
  visible,
  onToggleVisible,
  activeMode,
  onSelectMode,
  onSimulateHotReload,
}) => {
  const [reportExpanded, setReportExpanded] = useState(false);

  // Strictly hidden in normal consumer view unless ?debug=1 or ?data=... is present
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2">
      {reportExpanded && (
        <div className="mb-2 max-h-72 overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#0D0E14]/98 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} weight="fill" className="text-[#1ED760]" />
              <h3 className="text-xs font-semibold text-[#F8FAFC]">
                Matriz de Estrés Adversarial (break-ui) — Mitigaciones Activas
              </h3>
            </div>
            <button
              type="button"
              onClick={onSimulateHotReload}
              className="btn-press flex items-center gap-1 rounded-full border border-[#FF0033]/40 bg-[#FF0033]/12 px-3 py-1 text-[11px] font-medium text-[#FF4D6D] hover:bg-[#FF0033]/20"
            >
              <Lightning size={12} weight="fill" />
              <span>Probar Modal Renovación Sesión</span>
            </button>
          </div>

          <div className="mt-2.5 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-[#94A3B8]">
                  <th className="py-1.5 pr-3 font-medium">Estado</th>
                  <th className="py-1.5 pr-3 font-medium">Campo / Vector</th>
                  <th className="py-1.5 pr-3 font-medium">Valor Extremo Real</th>
                  <th className="py-1.5 font-medium">Defensa Aplicada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {BREAK_UI_AUDIT_FINDINGS.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#1ED760]/35 bg-[#1ED760]/14 px-2 py-0.5 text-[10px] font-medium text-[#1ED760]">
                        <CheckCircle size={11} weight="fill" />
                        {row.severity}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-[#F8FAFC] whitespace-nowrap">
                      {row.field}
                    </td>
                    <td className="py-2 pr-3 text-[#94A3B8] max-w-[240px] break-words">
                      {row.worstCaseValue}
                    </td>
                    <td className="py-2 text-[#F8FAFC]">{row.defensiveFix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-white/[0.12] bg-[#0D0E14]/95 px-4 py-2 shadow-[0_14px_34px_rgba(0,0,0,0.75)] backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Bug size={14} weight="bold" className="shrink-0 text-[#1ED760]" />
          <span className="text-[11px] font-semibold text-[#F8FAFC] whitespace-nowrap">
            QA break-ui:
          </span>
        </div>

        <div
          role="group"
          aria-label="Seleccionar dataset de auditoría UI"
          className="flex flex-wrap items-center gap-1 rounded-full bg-[#060609] p-1 border border-white/[0.08]"
        >
          {SEGMENTS.map((seg) => {
            const isSelected = activeMode === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => onSelectMode(seg.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#1ED760] text-[#060609] font-bold'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {seg.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setReportExpanded((prev) => !prev)}
            className="btn-press flex items-center gap-1 rounded-full border border-white/[0.1] bg-[#151722] px-3 py-1 text-[11px] font-medium text-[#F8FAFC]"
          >
            <span>Matriz QA</span>
            {reportExpanded ? <CaretDown size={12} /> : <CaretUp size={12} />}
          </button>
          <button
            type="button"
            onClick={onToggleVisible}
            className="btn-press rounded-full border border-white/[0.1] bg-[#151722] px-2.5 py-1 text-[11px] text-[#94A3B8] hover:text-[#F8FAFC]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
