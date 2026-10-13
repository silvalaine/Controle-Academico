import React, { useState } from 'react';
import {
  Cloud,
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Smartphone,
  Check,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { getSyncEmail, setSyncEmail, isQuotaCurrentlyBlocked, FIRESTORE_UPGRADE_URL, clearQuotaExceeded } from '../utils/cloudSync';
import { User } from '../types';

import { HardDrive } from 'lucide-react';

interface SyncEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onSyncEmailChanged: (newEmail: string) => void;
  onManualSync?: (email: string) => Promise<{ success: boolean; message: string; error?: string }>;
  onOpenGoogleDriveModal?: () => void;
  lastDevice?: string;
  lastUpdated?: string;
}

export const SyncEmailModal: React.FC<SyncEmailModalProps> = ({
  isOpen,
  onClose,
  currentUser: _currentUser,
  onSyncEmailChanged,
  onManualSync,
  onOpenGoogleDriveModal,
  lastDevice,
  lastUpdated
}) => {
  const [emailInput, setEmailInput] = useState(() => getSyncEmail());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const currentConfiguredEmail = getSyncEmail();

  const handleSelectPreset = (presetEmail: string) => {
    setEmailInput(presetEmail);
    setSyncResult(null);
  };

  // 100% AUTOMATIC ONE-CLICK SYNC
  const handleAutomaticSync = async () => {
    const clean = emailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setSyncResult({ success: false, message: 'Informe um endereço de e-mail válido para o canal de sincronização.' });
      return;
    }

    setSyncEmail(clean);
    onSyncEmailChanged(clean);
    setIsSyncing(true);
    setSyncResult(null);

    try {
      if (onManualSync) {
        const res = await onManualSync(clean);
        setSyncResult({
          success: res.success,
          message: res.message
        });
      } else {
        setSyncResult({ success: true, message: 'Sincronização concluída com sucesso!' });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err?.message || 'Não foi possível sincronizar com a nuvem no momento.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Cloud className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Sincronização em Nuvem
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> 100% Automática
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Atualização instantânea entre Computador e Celular
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-slate-700 text-xs overflow-y-auto max-h-[75vh]">
          {/* Card Info */}
          <div className="bg-indigo-50/70 border border-indigo-100/90 rounded-2xl p-4 flex items-start gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shrink-0 mt-0.5 shadow-xs">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="text-xs leading-relaxed">
              <h4 className="font-bold text-slate-900">Modo Automático Ativado</h4>
              <p className="text-slate-600 mt-1">
                Todas as alterações (criação de turmas, exclusões, notas, chamadas e alunos) são salvas e atualizadas <strong>automaticamente na nuvem</strong> em segundo plano. O botão abaixo permite forçar uma sincronização manual imediata se desejar.
              </p>
            </div>
          </div>

          {/* Email Channel Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Canal de Sincronização (E-mail Compartilhado):
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="ex: seu.email@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Canal ativo: <strong className="text-indigo-600">{currentConfiguredEmail}</strong></span>
              {emailInput !== 'lab.tecnologia.amparo@gmail.com' && (
                <button
                  type="button"
                  onClick={() => handleSelectPreset('lab.tecnologia.amparo@gmail.com')}
                  className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                >
                  Usar canal padrão
                </button>
              )}
            </div>
          </div>

          {/* Sync Status Banner */}
          {lastUpdated && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                Dispositivo: <strong>{lastDevice || 'Aparelho'}</strong>
              </span>
              <span>
                Última sincronização: <strong>{new Date(lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
              </span>
            </div>
          )}

          {/* Quota limit indicator in Sync Modal */}
          {isQuotaCurrentlyBlocked() && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-amber-950">Cota Diária Gratuita do Firestore Atingida</p>
                <p className="font-normal mt-0.5 text-amber-800 text-[11px] leading-relaxed">
                  A cota diária gratuita de gravações no Firestore para este projeto foi atingida hoje.
                  Seus dados continuam salvos com segurança localmente neste aparelho. A cota é reiniciada automaticamente à meia-noite (UTC).
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href={FIRESTORE_UPGRADE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 underline"
                  >
                    <span>Console do Firebase</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      clearQuotaExceeded();
                      handleAutomaticSync();
                    }}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline ml-2 cursor-pointer"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Result Alert */}
          {syncResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 transition animate-in fade-in duration-150 ${
                syncResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">{syncResult.success ? 'Sucesso!' : 'Atenção'}</p>
                <p className="font-normal mt-0.5 leading-snug">{syncResult.message}</p>
              </div>
            </div>
          )}

          {/* Big Automatic Sync Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAutomaticSync}
              disabled={isSyncing}
              className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center gap-2.5 text-white ${
                isSyncing
                  ? 'bg-indigo-400 cursor-wait'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] shadow-indigo-500/25'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando Automaticamente...' : 'Sincronizar Agora'}</span>
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Sincronização 100% automática: suas alterações (incluindo exclusões e edições) são atualizadas na nuvem.
            </p>

            {onOpenGoogleDriveModal && (
              <div className="pt-3 border-t border-slate-100 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGoogleDriveModal();
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl font-bold text-xs border border-emerald-600/30 bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-900 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <HardDrive className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Backup Direto & Restauração no Google Drive</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-slate-600 hover:text-slate-800 font-bold transition cursor-pointer text-xs rounded-xl hover:bg-slate-200/60"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
