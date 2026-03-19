'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Activity, Droplets, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Product } from '@/platform/services/model/product';
import type { Device } from '@/types/device';

type OperationMode = 'agentic' | 'autonomous';
type WebhookStatus = 'Ready' | 'Triggered' | 'Error';

interface HealthMonitorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device;
  product: Product | null;
  productName: string;
  customerId: string;
}

const WEBHOOK_URL = 'https://hook.emporix-cop.integromat.celonis.com/fvardsdlvw3gj3xabzniaep3ih3wwj83';
const COOLANT_THRESHOLD = 25;

// All colours reference the app's CSS design tokens so the modal
// automatically stays in sync with the brand theme.
const C = {
  bg: 'var(--color-surface-page)',
  card: 'var(--color-surface-disabled)',
  imageBg: 'var(--color-surface-image-background)',
  border: 'var(--color-border-primary)',
  accent: 'var(--color-surface-action)',
  accentText: 'var(--color-text-action)',
  onAccent: 'var(--color-text-on-action)',
  success: 'var(--color-text-success)',
  error: 'var(--color-text-error)',
  warning: 'var(--color-text-warning)',
  headings: 'var(--color-text-headings)',
  body: 'var(--color-text-body)',
  muted: 'var(--color-text-placeholders)',
} as const;

export function HealthMonitorModal({
  open,
  onOpenChange,
  device,
  product,
  productName,
  customerId,
}: HealthMonitorModalProps) {
  const initialLevel = Math.min(100, Math.max(0, Number(device.health) || 100));
  const [mode, setMode] = useState<OperationMode>('autonomous');
  const [coolantLevel, setCoolantLevel] = useState(initialLevel);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus>('Ready');
  const [logs, setLogs] = useState<string[]>([]);
  const wasAboveThreshold = useRef(initialLevel >= COOLANT_THRESHOLD);
  const logsRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string) => {
    const ts = new Date().toLocaleTimeString('en', { hour12: false });
    setLogs((prev) => [`[${ts}] ${message}`, ...prev].slice(0, 30));
  }, []);

  const triggerWebhook = useCallback(
    async (currentMode: OperationMode) => {
      setWebhookStatus('Triggered');
      addLog(`Coolant below ${COOLANT_THRESHOLD}% — calling ${currentMode} webhook…`);
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: currentMode,
            customerId,
            companyId: device.companyId ?? '',
            productId: device.productId ?? '',
            serial: device.serialNumber,
          }),
        });
        if (res.ok) {
          addLog(`Webhook accepted (HTTP ${res.status})`);
        } else {
          setWebhookStatus('Error');
          addLog(`Webhook failed (HTTP ${res.status})`);
        }
      } catch (err) {
        setWebhookStatus('Error');
        getLogger().error({ err }, 'Health monitor webhook failed');
        addLog(`Webhook error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [addLog, customerId, device.companyId, device.productId, device.serialNumber],
  );

  useEffect(() => {
    const isBelow = coolantLevel < COOLANT_THRESHOLD;
    if (isBelow && wasAboveThreshold.current) {
      wasAboveThreshold.current = false;
      triggerWebhook(mode);
    } else if (!isBelow) {
      wasAboveThreshold.current = true;
      setWebhookStatus('Ready');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coolantLevel]);

  useEffect(() => {
    if (open) {
      setMode('autonomous');
      setCoolantLevel(initialLevel);
      setWebhookStatus('Ready');
      setLogs([]);
      wasAboveThreshold.current = initialLevel >= COOLANT_THRESHOLD;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    setCoolantLevel(initialLevel);
    setWebhookStatus('Ready');
    wasAboveThreshold.current = initialLevel >= COOLANT_THRESHOLD;
    addLog(`System reset — coolant level restored to ${initialLevel}%`);
  };

  const isCritical = coolantLevel < COOLANT_THRESHOLD;
  const webhookColor = webhookStatus === 'Ready' ? C.success : webhookStatus === 'Error' ? C.error : C.warning;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full p-0 overflow-hidden">
        <DialogTitle className="sr-only">Asset Health Monitor</DialogTitle>
        <DialogDescription className="sr-only">Health monitor for device — Model: {productName}</DialogDescription>

        <div className="p-6 flex flex-col gap-5" style={{ color: C.body }}>
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 text-xl font-bold" style={{ color: C.headings }}>
              <Activity className="h-5 w-5" style={{ color: C.accentText }} />
              Asset Health Monitor
            </div>
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              {productName} · Serial: {device.serialNumber}
            </p>
          </div>

          {/* Two-column body */}
          <div className="grid grid-cols-5 gap-4">
            {/* Left (3/5) */}
            <div className="col-span-3 flex flex-col gap-4">
              {/* Operation Mode */}
              <div className="rounded-md p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
                <p
                  className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                  style={{ color: C.accentText }}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Operation Mode
                </p>
                <div className="flex rounded-sm overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  {(['agentic', 'autonomous'] as OperationMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="flex-1 py-2 text-sm font-medium transition-colors"
                      style={
                        mode === m
                          ? { backgroundColor: C.accent, color: C.onAccent }
                          : { backgroundColor: C.bg, color: C.body }
                      }
                    >
                      {m === 'agentic' ? 'Agentic Mode' : 'Autonomous Mode'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Device Status */}
              <div className="rounded-md p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
                <p
                  className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                  style={{ color: C.success }}
                >
                  <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: C.success }} />
                  Device Status
                </p>
                <div className="flex gap-4">
                  <div
                    className="relative h-28 w-28 flex-shrink-0 rounded overflow-hidden"
                    style={{
                      backgroundColor: C.imageBg,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    {product?.images && product.images.length > 0 ? (
                      <Image src={product.images[0].url} alt={productName} fill className="object-contain p-2" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Image src="/images/no_image_alt.png" alt="" width={40} height={40} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-between py-1 text-sm">
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: C.muted }}>
                        Inverter ID
                      </p>
                      <p className="font-bold" style={{ color: C.accentText }}>
                        {device.serialNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: C.muted }}>
                        Model
                      </p>
                      <p className="font-medium" style={{ color: C.headings }}>
                        {productName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: C.muted }}>
                        Status
                      </p>
                      <p className="font-bold" style={{ color: C.success }}>
                        Active
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right (2/5): Coolant gauge */}
            <div
              className="col-span-2 rounded-md p-4 flex flex-col"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
            >
              <p
                className="flex items-center gap-2 text-xs font-semibold mb-4 uppercase tracking-wider"
                style={{ color: C.accentText }}
              >
                <Droplets className="h-3.5 w-3.5" />
                Coolant Level
              </p>

              <div className="flex-1 flex flex-col items-center gap-3">
                {/* Gauge bar */}
                <div
                  className="relative w-20 h-36 rounded overflow-hidden"
                  style={{ backgroundColor: C.imageBg, border: `1px solid ${C.border}` }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 transition-all duration-300"
                    style={{
                      height: `${coolantLevel}%`,
                      backgroundColor: isCritical ? C.error : C.accent,
                      opacity: 0.85,
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-bold text-xl leading-none" style={{ color: C.headings }}>
                      {coolantLevel}%
                    </span>
                    <span className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                      Current Level
                    </span>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={coolantLevel}
                  onChange={(e) => setCoolantLevel(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />

                {/* Stats */}
                <div className="w-full space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: C.body }}>Threshold</span>
                    <span style={{ color: C.error, fontWeight: 500 }}>&lt; 25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: C.body }}>Webhook Status</span>
                    <span style={{ color: webhookColor, fontWeight: 500 }}>{webhookStatus}</span>
                  </div>
                </div>

                {/* Reset */}
                <button
                  onClick={handleReset}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: C.bg,
                    border: `1px solid ${C.border}`,
                    color: C.body,
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset System
                </button>
              </div>
            </div>
          </div>

          {/* System Logs */}
          <div className="rounded-md p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: C.headings }}>
              System Logs
            </p>
            <div
              ref={logsRef}
              className="min-h-[48px] max-h-[72px] overflow-y-auto font-mono text-xs space-y-0.5"
              style={{ color: C.body }}
            >
              {logs.length === 0 ? (
                <p style={{ color: C.muted }}>No events logged yet...</p>
              ) : (
                logs.map((log, i) => (
                  <p key={i} className="leading-relaxed">
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
