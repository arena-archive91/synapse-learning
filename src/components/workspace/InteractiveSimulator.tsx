import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, SlidersHorizontal, Target, Zap } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useI18n } from '../../lib/i18n';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

const PRESET_KEYS = [
  { id: 'baseline', key: 'presetBaseline' as const, demand: 0, supply: 0 },
  { id: 'demand-boom', key: 'presetDemandBoom' as const, demand: 25, supply: 0 },
  { id: 'supply-shock', key: 'presetSupplyShock' as const, demand: 0, supply: 25 },
  { id: 'recession', key: 'presetRecession' as const, demand: -20, supply: 10 },
];

const CHALLENGE_TARGET_P = 55;
const CHALLENGE_TOLERANCE = 3;

interface Props {
  insight?: string;
  economicsMode?: boolean;
  emptyMessage?: string;
  onUpload?: () => void;
}

export function InteractiveSimulator({ insight, economicsMode = false, emptyMessage, onUpload }: Props) {
  const { t } = useI18n();
  const [demandShift, setDemandShift] = useState(0);
  const [supplyShift, setSupplyShift] = useState(0);

  const w = 360;
  const h = 280;
  const pad = 40;
  const gw = w - 2 * pad;
  const gh = h - 2 * pad;

  const eqP = (100 + demandShift - supplyShift) / 2;
  const eqQ = eqP + supplyShift;
  const challengeMet = Math.abs(eqP - CHALLENGE_TARGET_P) <= CHALLENGE_TOLERANCE;

  const scaleX = gw / 140;
  const scaleY = gh / 140;
  const toX = (q: number) => pad + q * scaleX;
  const toY = (p: number) => h - pad - p * scaleY;

  const dQ0 = 100 + demandShift;
  const dP0 = 100 + demandShift;
  const sP_Q0 = -supplyShift;
  const sP1 = Math.max(0, sP_Q0);
  const sQ1 = sP1 + supplyShift;
  const sP2 = 140;
  const sQ2 = sP2 + supplyShift;

  const presetButtons = useMemo(() => PRESET_KEYS, []);

  if (!economicsMode) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle bg-surface-card px-4 py-2.5 shrink-0">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="w-4 h-4 text-brand-400" />
            {t('parametricSandbox')}
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <WorkspaceEmptyState
            message={emptyMessage ?? (insight || t('sandboxInsight'))}
            onUpload={onUpload}
          />
          {insight && (
            <div className="mt-4 w-full max-w-2xl rounded-xl border border-accent-cyan/25 bg-accent-cyan/5 p-4 text-left text-xs text-text-secondary leading-relaxed">
              {insight}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface-card px-4 py-2.5 shrink-0">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="w-4 h-4 text-brand-400" />
          {t('parametricSandbox')}
        </span>
        <span className="rounded border border-accent-teal/35 bg-accent-teal/15 px-2.5 py-1 text-xs text-accent-teal">
          {t('liveEquilibrium')}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-y-auto p-4">
        <div className="mb-3 w-full max-w-sm">
          <p className="mb-1.5 text-xs font-medium text-text-tertiary">{t('presets')}</p>
          <div className="flex flex-wrap gap-1.5">
            {presetButtons.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setDemandShift(p.demand); setSupplyShift(p.supply); }}
                className="rounded-full border border-border-subtle bg-surface-primary/50 px-2.5 py-1 text-xs hover:border-brand-500/40 transition-all"
              >
                {t(p.key)}
              </button>
            ))}
          </div>
        </div>

        <svg width={w} height={h} className="mb-3 block overflow-visible">
          <line x1={pad} y1={pad - 10} x2={pad} y2={h - pad} stroke="#6b6494" strokeWidth={2} />
          <line x1={pad} y1={h - pad} x2={w - pad + 10} y2={h - pad} stroke="#6b6494" strokeWidth={2} />
          <text x={pad - 15} y={pad} fill="#b8b3d4" fontSize={11} fontWeight="bold">P</text>
          <text x={w - pad} y={h - pad + 15} fill="#b8b3d4" fontSize={11} fontWeight="bold">Q</text>

          <motion.polygon
            points={`${toX(0)},${toY(dQ0)} ${toX(eqQ)},${toY(eqP)} ${toX(0)},${toY(eqP)}`}
            fill="#34d399" opacity={0.15}
            animate={{ points: `${toX(0)},${toY(dQ0)} ${toX(eqQ)},${toY(eqP)} ${toX(0)},${toY(eqP)}` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          />
          <motion.polygon
            points={`${toX(0)},${toY(eqP)} ${toX(eqQ)},${toY(eqP)} ${toX(0)},${toY(Math.max(0, sP_Q0))}`}
            fill="#818cf8" opacity={0.15}
            animate={{ points: `${toX(0)},${toY(eqP)} ${toX(eqQ)},${toY(eqP)} ${toX(0)},${toY(Math.max(0, sP_Q0))}` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          />
          <motion.line
            x1={toX(0)} y1={toY(dQ0)} x2={toX(dP0)} y2={toY(0)}
            stroke="#34d399" strokeWidth={3} strokeLinecap="round"
            animate={{ x1: toX(0), y1: toY(dQ0), x2: toX(dP0), y2: toY(0) }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          />
          <text x={toX(dP0) - 10} y={toY(0) - 10} fill="#34d399" fontSize={12} fontWeight="bold">D</text>
          <motion.line
            x1={toX(sQ1)} y1={toY(sP1)} x2={toX(sQ2)} y2={toY(sP2)}
            stroke="#818cf8" strokeWidth={3} strokeLinecap="round"
            animate={{ x1: toX(sQ1), y1: toY(sP1), x2: toX(sQ2), y2: toY(sP2) }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          />
          <text x={toX(sQ2) - 10} y={toY(sP2) + 15} fill="#818cf8" fontSize={12} fontWeight="bold">S</text>
          <line x1={pad} y1={toY(eqP)} x2={toX(eqQ)} y2={toY(eqP)} stroke="#fbbf24" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
          <line x1={toX(eqQ)} y1={h - pad} x2={toX(eqQ)} y2={toY(eqP)} stroke="#fbbf24" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
          <circle cx={toX(eqQ)} cy={toY(eqP)} r={6} fill="#fbbf24" />
        </svg>

        <div className="mb-4 flex gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-accent-emerald">
            <span className="h-3.5 w-3.5 rounded-sm border border-accent-emerald bg-accent-emerald/25" />
            {t('consumerSurplus')}
          </span>
          <span className="flex items-center gap-1.5 text-brand-300">
            <span className="h-3.5 w-3.5 rounded-sm border border-brand-400 bg-brand-500/25" />
            {t('producerSurplus')}
          </span>
        </div>

        <div className="mb-3 w-full max-w-sm rounded-xl border border-border-subtle bg-surface-primary/50 p-3">
          <p className="mb-1 text-[11px] font-semibold text-brand-300">{t('equilibriumFormulas')}</p>
          <p className="font-mono text-sm text-text-secondary">P* = (100 + ΔD − ΔS) / 2</p>
          <p className="font-mono text-sm text-text-secondary">Q* = P* + ΔS</p>
        </div>

        <div className="w-full max-w-sm space-y-4 rounded-xl border border-border-subtle bg-surface-card p-4">
          <div>
            <div className="mb-2 flex justify-between">
              <label className="text-xs font-semibold text-accent-emerald">{t('demandShock')}</label>
              <span className="font-mono text-xs text-text-tertiary">{demandShift > 0 ? '+' : ''}{demandShift}</span>
            </div>
            <input type="range" min={-40} max={40} value={demandShift} onChange={(e) => setDemandShift(Number(e.target.value))} className="w-full" style={{ accentColor: '#34d399' }} />
          </div>
          <div>
            <div className="mb-2 flex justify-between">
              <label className="text-xs font-semibold text-brand-300">{t('supplyShock')}</label>
              <span className="font-mono text-xs text-text-tertiary">{supplyShift > 0 ? '+' : ''}{supplyShift}</span>
            </div>
            <input type="range" min={-40} max={40} value={supplyShift} onChange={(e) => setSupplyShift(Number(e.target.value))} className="w-full" style={{ accentColor: '#818cf8' }} />
          </div>
          <div className="flex items-center justify-between border-t border-border-subtle pt-3 font-mono text-sm">
            <span>P* = <strong>{eqP.toFixed(1)}</strong></span>
            <ArrowRight className="w-4 h-4 text-text-muted" />
            <span>Q* = <strong>{eqQ.toFixed(1)}</strong></span>
          </div>
        </div>

        <div className={cn(
          'mt-4 w-full max-w-sm rounded-lg border p-3.5 text-sm',
          challengeMet ? 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald' : 'border-accent-amber/35 bg-accent-amber/8 text-text-secondary',
        )}>
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Target className="w-4 h-4" />
            {t('challengeTitle')} {CHALLENGE_TARGET_P}
          </div>
          {challengeMet ? (
            <p>{t('challengeSuccess')} {eqP.toFixed(1)}.</p>
          ) : (
            <>
              <p>{t('challengeAdjust')}{CHALLENGE_TOLERANCE} of {CHALLENGE_TARGET_P}.</p>
              <p className="mt-1 text-xs text-text-tertiary">{t('challengeHint')}</p>
            </>
          )}
        </div>

        <div className="mt-4 flex w-full max-w-sm items-start gap-2 rounded-lg border border-brand-500/30 bg-brand-500/12 p-3.5 text-sm text-brand-200">
          <Zap className="mt-0.5 w-4 h-4 shrink-0" />
          <p>{insight ?? t('sandboxInsight')}</p>
        </div>
      </div>
    </div>
  );
}
