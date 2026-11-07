/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Key,
  ShieldCheck,
  Database,
  Layers,
  ArrowRight,
  Copy,
  Check,
  HeartHandshake
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  KOFI_SHOP_URL,
  getStoredLicense,
  activateLicense,
  deactivateLicense,
  LicenseStatus
} from '../utils/licenseManager';

interface ProLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProLicenseModal: React.FC<ProLicenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { isBright } = useTheme();
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<LicenseStatus>({ isPro: false });

  useEffect(() => {
    if (isOpen) {
      setStatus(getStoredLicense());
      setErrorMsg(null);
      setSuccessMsg(null);
      setLicenseKeyInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = activateLicense(licenseKeyInput);
    if (res.success) {
      setSuccessMsg('🎉 Congratulations! SheetSQL Pro is now permanently unlocked.');
      setStatus(getStoredLicense());
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1400);
    } else {
      setErrorMsg(res.error || 'Invalid license key');
    }
  };

  const handleDeactivate = () => {
    deactivateLicense();
    setStatus({ isPro: false });
    setSuccessMsg('License removed.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-colors flex flex-col max-h-[92vh] ${
          isBright
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-[#091224] border-[#1e2f54] text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.6)]'
        }`}
      >
        {/* Modal Header with Ko-fi gradient banner */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900 shadow-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 fill-current" />
              <span>Lifetime License</span>
            </span>
          </div>

          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <span>Unlock SheetSQL Pro</span>
            <span className="text-amber-300">💎</span>
          </h2>
          <p className="text-xs text-blue-100 mt-1 leading-relaxed">
            Direct PostgreSQL connections, TCP Bridge proxy, and unlimited multi-database SQL querying.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Active Pro Status View */}
          {status.isPro ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-bold text-sm">SheetSQL Pro is Active</span>
              </div>
              <p className="text-[11px] text-slate-300">
                You have permanent access to all Pro features, including the live PostgreSQL DBeaver
                connector and local TCP Bridge.
              </p>
              {status.key && (
                <div className="font-mono text-xs px-2.5 py-1.5 rounded bg-black/30 text-emerald-200 border border-emerald-500/20 truncate">
                  Key: {status.key}
                </div>
              )}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer shadow-xs"
                >
                  Start Using Pro
                </button>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  className="text-[11px] text-red-400 hover:underline cursor-pointer"
                >
                  Deactivate key
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Pro Feature Highlights */}
              <div
                className={`p-3.5 rounded-xl border space-y-2.5 ${
                  isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#060b17] border-[#162544]'
                }`}
              >
                <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>Pro Included Features:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Real PostgreSQL (Localhost, Neon, Supabase, RDS)</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Full TCP Bridge Companion script</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Cross-SQL Joins: Excel + PostgreSQL</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Lifetime updates, 0 subscriptions</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Buy on Ko-fi */}
              <div
                className={`p-4 rounded-xl border transition-colors ${
                  isBright
                    ? 'bg-gradient-to-r from-pink-50 to-amber-50 border-pink-200'
                    : 'bg-gradient-to-r from-pink-950/20 via-indigo-950/20 to-amber-950/20 border-[#2a1c4a]'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400">
                      <HeartHandshake className="w-4 h-4" />
                      <span>Step 1: Get Your License on Ko-fi</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                      Support development with a one-time purchase. Your license key will be delivered instantly on your Ko-fi receipt.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 shrink-0">
                    Pay once, keep forever
                  </span>
                </div>

                <a
                  href={KOFI_SHOP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer group"
                >
                  <img
                    src="https://storage.ko-fi.com/cdn/cup-border.png"
                    alt="Ko-fi"
                    className="w-4 h-4 object-contain filter brightness-200"
                  />
                  <span>Get License Key on Ko-fi</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>

              {/* Step 2: Enter License Key */}
              <form onSubmit={handleActivate} className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Step 2: Enter Your Activation Key</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">Format: SSQL-PRO-XXXX...</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
                    placeholder="SSQL-PRO-XXXX-YYYY-ZZZZ"
                    className={`flex-1 px-3 py-2 rounded-lg border font-mono text-xs tracking-wider uppercase focus:outline-none focus:border-blue-500 transition-colors ${
                      isBright
                        ? 'bg-slate-50 border-slate-300 text-slate-800'
                        : 'bg-[#060b17] border-[#182c54] text-slate-200 placeholder:text-slate-600'
                    }`}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <span>Activate Pro</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Success Banner */}
                {successMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{successMsg}</span>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between text-[11px] ${
            isBright ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#070b16] border-[#162544] text-slate-400'
          }`}
        >
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Encrypted offline verification</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:underline text-slate-400 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
