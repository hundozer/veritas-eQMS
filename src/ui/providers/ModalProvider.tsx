'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ModalFieldType = 'text' | 'number' | 'select' | 'date' | 'textarea';

export interface ModalFieldOption {
  label: string;
  value: string;
}

export interface ModalField {
  id: string;
  label: string;
  type: ModalFieldType;
  options?: ModalFieldOption[];
  placeholder?: string;
  required?: boolean;
  initialValue?: string;
}

export interface ModalStep {
  id: string;
  label: string;
  fields: ModalField[];
}

interface FormModalConfig {
  type: 'form';
  title: string;
  subtitle?: string;
  fields?: ModalField[];
  steps?: ModalStep[];
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmModalConfig {
  type: 'confirm';
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ModalConfig = FormModalConfig | ConfirmModalConfig;

interface ModalContextValue {
  openForm: (config: Omit<FormModalConfig, 'type'>) => Promise<Record<string, string> | null>;
  confirm: (config: Omit<ConfirmModalConfig, 'type'>) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ModalConfig | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resolver, setResolver] = useState<((value: any) => void) | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const close = useCallback((value: any) => {
    if (resolver) resolver(value);
    setResolver(null);
    setConfig(null);
    setValues({});
  }, [resolver]);

  const openForm = useCallback((cfg: Omit<FormModalConfig, 'type'>) => {
    return new Promise<Record<string, string> | null>((resolve) => {
      const initial: Record<string, string> = {};
      const fields = cfg.steps
        ? cfg.steps.flatMap((s) => s.fields)
        : (cfg.fields ?? []);
      fields.forEach((f) => {
        if (f.initialValue !== undefined) initial[f.id] = f.initialValue;
      });
      setValues(initial);
      setStepIndex(0);
      setConfig({ ...cfg, type: 'form' });
      setResolver(() => resolve);
    });
  }, []);

  const confirm = useCallback((cfg: Omit<ConfirmModalConfig, 'type'>) => {
    return new Promise<boolean>((resolve) => {
      setConfig({ ...cfg, type: 'confirm' });
      setResolver(() => resolve);
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && config) close(config.type === 'confirm' ? false : null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [config, close]);

  const ctxValue = useMemo<ModalContextValue>(() => ({ openForm, confirm }), [openForm, confirm]);

  return (
    <ModalContext.Provider value={ctxValue}>
      {children}
      <div
        className={`modal-overlay${config ? ' open' : ''}`}
        onClick={() => {
          if (!config) return;
          close(config.type === 'confirm' ? false : null);
        }}
      >
        {config && (
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => close(config.type === 'confirm' ? false : null)} aria-label="Close">
              x
            </button>
            <div className="modal-content">
              <div className="modal-title">{config.title}</div>
              {config.subtitle && <div className="modal-subtitle">{config.subtitle}</div>}

              {config.type === 'form' && (
                <div>
                  {config.steps && (
                    <div className="wizard-steps">
                      {config.steps.map((step, idx) => {
                        const done = idx < stepIndex;
                        const active = idx === stepIndex;
                        return (
                          <div key={step.id} className={`wiz-step${active ? ' active' : ''}`}>
                            <div className={`wiz-dot${done ? ' done' : ''}${active ? ' active' : ''}`} />
                            <div className={`wiz-step-line${done ? ' done' : ''}`} />
                            <div className="wiz-lbl">{step.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(config.steps ? config.steps[stepIndex].fields : (config.fields ?? [])).map((field) => (
                    <div key={field.id} className="form-row">
                      <label className="form-label" htmlFor={field.id}>{field.label}</label>
                      {field.type === 'textarea' && (
                        <textarea
                          id={field.id}
                          className="form-input"
                          rows={3}
                          placeholder={field.placeholder}
                          value={values[field.id] ?? ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        />
                      )}
                      {field.type === 'select' && (
                        <select
                          id={field.id}
                          className="form-input"
                          value={values[field.id] ?? ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        >
                          <option value="">Select...</option>
                          {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                      {field.type !== 'textarea' && field.type !== 'select' && (
                        <input
                          id={field.id}
                          className="form-input"
                          type={field.type}
                          placeholder={field.placeholder}
                          value={values[field.id] ?? ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {config.type === 'form' && config.steps && stepIndex > 0 && (
                <button
                  className="card-btn outline"
                  type="button"
                  onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                >
                  Back
                </button>
              )}
              <button className="card-btn outline" type="button" onClick={() => close(config.type === 'confirm' ? false : null)}>
                {config.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={`card-btn ${config.type === 'confirm' && config.danger ? 'danger-btn' : 'green'}`}
                type="button"
                onClick={() => {
                  if (config.type === 'confirm') {
                    close(true);
                    return;
                  }
                  if (config.steps) {
                    const stepFields = config.steps[stepIndex].fields;
                    const missing = stepFields.filter((f) => f.required && !values[f.id]?.trim());
                    if (missing.length) return;
                    if (stepIndex < config.steps.length - 1) {
                      setStepIndex((prev) => prev + 1);
                      return;
                    }
                  } else {
                    const missing = (config.fields ?? []).filter((f) => f.required && !values[f.id]?.trim());
                    if (missing.length) return;
                  }
                  close(values);
                }}
              >
                {config.type === 'form' && config.steps && stepIndex < config.steps.length - 1
                  ? 'Next'
                  : (config.confirmLabel ?? 'Save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalContext.Provider>
  );
}
