import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  RefreshCw,
  HardDrive,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Database,
  Calendar,
  Layers,
  Users,
  BookOpen,
  LogOut,
  FileJson
} from 'lucide-react';
import { AppDataState } from '../utils/storage';
import {
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups,
  downloadBackupFromGoogleDrive,
  deleteBackupFromGoogleDrive,
  exportBackupJsonFile,
  DriveBackupFile
} from '../utils/googleDrive';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleAccessToken,
  getConnectedGoogleUser,
  initGoogleDriveAuth,
  toDriveAuthError,
  ConnectedGoogleAccount,
  DriveAuthErrorCode
} from '../firebase';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppDataState;
  onRestoreData: (restoredData: AppDataState) => void;
  activeEmail: string;
  isQuotaExceeded?: boolean;
}

const GoogleLogoIcon: React.FC = () => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    style={{ display: 'block', width: '18px', height: '18px' }}
  >
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
  data,
  onRestoreData,
  activeEmail,
  isQuotaExceeded = false
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    errorCode?: DriveAuthErrorCode;
  } | null>(null);

  // Google Drive Auth & Connection State
  const [hasDriveToken, setHasDriveToken] = useState<boolean>(() => !!getGoogleAccessToken());
  const [googleAccount, setGoogleAccount] = useState<ConnectedGoogleAccount | null>(() => getConnectedGoogleUser());

  // Backups list from Drive
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [hasLoadedBackups, setHasLoadedBackups] = useState(false);

  // Destructive Confirmation States (per Workspace security requirements)
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<DriveBackupFile | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<DriveBackupFile | null>(null);

  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

  const syncConnectionState = () => {
    const token = getGoogleAccessToken();
    setHasDriveToken(!!token);
    setGoogleAccount(getConnectedGoogleUser());
  };

  useEffect(() => {
    const unsub = initGoogleDriveAuth(
      (account) => {
        setHasDriveToken(true);
        setGoogleAccount(account);
      },
      () => {
        setHasDriveToken(!!getGoogleAccessToken());
        setGoogleAccount(getConnectedGoogleUser());
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStatusMessage(null);
      const token = getGoogleAccessToken();
      setHasDriveToken(!!token);
      setGoogleAccount(getConnectedGoogleUser());
      // Only auto-load backups if an active Drive token is already cached in memory
      // so we never trigger unexpected popups outside a direct user click
      if (activeTab === 'restore' && token && !hasLoadedBackups) {
        handleLoadBackups();
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Explicit Google Sign-In handler (must be called directly from user click)
  const handleConnectGoogle = async (options?: { forceAccountSelect?: boolean; preferDirectOAuth?: boolean; loadListAfter?: boolean }) => {
    setIsLoggingIn(true);
    setStatusMessage(null);

    try {
      const res = await connectGoogleDrive({
        forceAccountSelect: options?.forceAccountSelect ?? true,
        preferDirectOAuth: options?.preferDirectOAuth ?? false
      });
      setHasDriveToken(true);
      setGoogleAccount(res.account);

      if (options?.loadListAfter || activeTab === 'restore') {
        await handleLoadBackups();
      } else {
        setStatusMessage({
          type: 'success',
          text: res.account?.email
            ? `Conta Google conectada (${res.account.email})! Agora você já pode salvar ou restaurar backups no Drive.`
            : 'Conta Google conectada com sucesso! Agora você já pode salvar ou restaurar backups no Drive.'
        });
      }
    } catch (err: any) {
      const authErr = toDriveAuthError(err);
      syncConnectionState();
      setStatusMessage({
        type: 'error',
        text: authErr.message,
        errorCode: authErr.code
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await disconnectGoogleDrive();
    setHasDriveToken(false);
    setGoogleAccount(null);
    setBackups([]);
    setHasLoadedBackups(false);
    setStatusMessage({
      type: 'info',
      text: 'Conta Google desconectada. Clique em "Entrar com o Google" quando desejar conectar novamente.'
    });
  };

  // Offline local JSON fallback
  const handleLocalJsonDownload = () => {
    try {
      const filename = exportBackupJsonFile(data);
      setStatusMessage({
        type: 'success',
        text: `Cópia de segurança salva neste aparelho: "${filename}". Você também pode enviá-la manualmente para o Google Drive quando desejar.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Não foi possível gerar o arquivo local: ${err?.message || 'erro inesperado'}`
      });
    }
  };

  // Handle Manual Upload to Drive
  const handleUploadBackup = async () => {
    setIsLoading(true);
    setLoadingAction('Enviando cópia para o Google Drive...');
    setStatusMessage(null);

    try {
      const file = await uploadBackupToGoogleDrive(data);
      syncConnectionState();
      setStatusMessage({
        type: 'success',
        text: `Backup salvo com sucesso no Google Drive! Arquivo: "${file.name}" (${file.size})`
      });
      setHasLoadedBackups(false);
    } catch (err: any) {
      console.error(err);
      const authErr = toDriveAuthError(err);
      syncConnectionState();
      setStatusMessage({
        type: 'error',
        text: authErr.message,
        errorCode: authErr.code
      });
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  // Handle Fetching List from Drive
  const handleLoadBackups = async () => {
    setIsLoading(true);
    setLoadingAction('Consultando backups no Google Drive...');
    setStatusMessage(null);

    try {
      const list = await listGoogleDriveBackups();
      syncConnectionState();
      setBackups(list);
      setHasLoadedBackups(true);
    } catch (err: any) {
      console.error(err);
      const authErr = toDriveAuthError(err);
      syncConnectionState();
      setStatusMessage({
        type: 'error',
        text: authErr.message,
        errorCode: authErr.code
      });
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  // Execute Restore after confirmation
  const handleExecuteRestore = async (file: DriveBackupFile) => {
    setIsLoading(true);
    setLoadingAction(`Baixando e restaurando "${file.name}"...`);
    setStatusMessage(null);
    setConfirmRestoreFile(null);

    try {
      const res = await downloadBackupFromGoogleDrive(file.id);
      syncConnectionState();
      onRestoreData(res.data);
      setStatusMessage({
        type: 'success',
        text: `Dados do backup "${file.name}" restaurados com sucesso no seu Diário!`
      });
    } catch (err: any) {
      console.error(err);
      const authErr = toDriveAuthError(err);
      syncConnectionState();
      setStatusMessage({
        type: 'error',
        text: authErr.message,
        errorCode: authErr.code
      });
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  // Execute Delete after confirmation
  const handleDeleteFile = async (file: DriveBackupFile) => {
    setIsLoading(true);
    setLoadingAction(`Removendo "${file.name}" do Google Drive...`);
    setStatusMessage(null);
    setConfirmDeleteFile(null);

    try {
      await deleteBackupFromGoogleDrive(file.id);
      syncConnectionState();
      setBackups(prev => prev.filter(b => b.id !== file.id));
      setStatusMessage({
        type: 'info',
        text: `O backup "${file.name}" foi removido do seu Google Drive.`
      });
    } catch (err: any) {
      console.error(err);
      const authErr = toDriveAuthError(err);
      syncConnectionState();
      setStatusMessage({
        type: 'error',
        text: authErr.message,
        errorCode: authErr.code
      });
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const renderGoogleSignInButton = (label: string = 'Entrar com o Google', loadListAfter: boolean = false) => (
    <button
      type="button"
      onClick={() => handleConnectGoogle({ forceAccountSelect: true, loadListAfter })}
      disabled={isLoggingIn || isLoading}
      className="gsi-material-button shadow-xs"
    >
      <div className="gsi-material-button-state"></div>
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          <GoogleLogoIcon />
        </div>
        <span className="gsi-material-button-contents">
          {isLoggingIn ? 'Conectando...' : label}
        </span>
        <span style={{ display: 'none' }}>{label}</span>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 shadow-inner shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">Backup no Google Drive</h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Nuvem Pessoal
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 font-mono mt-0.5 truncate">
                {hasDriveToken
                  ? `Drive conectado: ${googleAccount?.email || 'Conta Google autorizada'}`
                  : `Canal do Diário: ${activeEmail || 'lab.tecnologia.amparo@gmail.com'}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Account Connection Status Strip */}
        <div className="px-6 py-2.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
          {hasDriveToken ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="truncate">
                  Conectado ao Google Drive:{' '}
                  <strong className="text-white font-semibold">
                    {googleAccount?.email || googleAccount?.displayName || 'Sessão ativa'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleConnectGoogle({ forceAccountSelect: true })}
                  disabled={isLoggingIn || isLoading}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition cursor-pointer"
                >
                  Trocar Conta
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  disabled={isLoggingIn || isLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-semibold transition cursor-pointer"
                  title="Desconectar sessão do Google Drive"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sair</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2 w-full flex-wrap">
              <div className="flex items-center gap-2 text-amber-200/95">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                <span className="text-[11px]">
                  Conecte sua conta Google pessoal ou escolar para enviar ou importar backups do Drive
                </span>
              </div>
              {renderGoogleSignInButton('Entrar com o Google', activeTab === 'restore')}
            </div>
          )}
        </div>

        {/* Informational Quota Notice (if Firestore quota exceeded) */}
        {isQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3 text-xs text-amber-900">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Cota do Firestore atingida hoje</p>
              <p className="text-amber-800 text-[11px] leading-relaxed mt-0.5">
                Os backups no seu <strong>Google Drive são ilimitados e independentes da cota do Firestore</strong>. Salve cópias de segurança diretamente no seu Drive a qualquer momento.
              </p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-t border-x cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-white text-indigo-600 border-slate-200 -mb-px shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Fazer Backup no Drive</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('restore');
              if (getGoogleAccessToken() && !hasLoadedBackups) {
                handleLoadBackups();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-t border-x cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-white text-indigo-600 border-slate-200 -mb-px shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Importar do Google Drive</span>
            {backups.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-semibold">
                {backups.length}
              </span>
            )}
          </button>
        </div>

        {/* Status Feedback Toast/Banner with Recovery Actions */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-2xl text-xs font-medium border space-y-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                {statusMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                {statusMessage.type === 'info' && <HardDrive className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                <span className="leading-relaxed">{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-600 ml-2 shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {statusMessage.type === 'error' && (
              <div className="flex flex-wrap items-center gap-2 pt-1 pl-6">
                <button
                  type="button"
                  onClick={() =>
                    handleConnectGoogle({
                      forceAccountSelect: true,
                      loadListAfter: activeTab === 'restore'
                    })
                  }
                  disabled={isLoggingIn || isLoading}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                >
                  Tentar Novamente (Google)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleConnectGoogle({
                      forceAccountSelect: true,
                      preferDirectOAuth: true,
                      loadListAfter: activeTab === 'restore'
                    })
                  }
                  disabled={isLoggingIn || isLoading}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100/70 text-rose-900 border border-rose-300 font-bold text-[11px] transition cursor-pointer"
                  title="Alternativa quando o navegador bloqueia cookies de terceiros em janelas integradas"
                >
                  Conectar via OAuth Direto
                </button>
                <button
                  type="button"
                  onClick={handleLocalJsonDownload}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Baixar Backup (.json)</span>
                </button>
                {isInsideIframe && typeof window !== 'undefined' && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] transition"
                    title="Se o navegador bloquear cookies de terceiros dentro do painel, abra em uma aba própria"
                  >
                    <span>Abrir em Nova Aba</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'backup' ? (
            <div className="space-y-5">
              {/* Current Data Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Resumo dos Dados Atuais a Serem Salvos</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-lg font-black text-slate-800 block">{data.classes?.length || 0}</span>
                    <span className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-400" /> Turmas
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-lg font-black text-slate-800 block">{data.students?.length || 0}</span>
                    <span className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                      <Users className="w-3 h-3 text-emerald-400" /> Alunos
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-lg font-black text-slate-800 block">{data.assessments?.length || 0}</span>
                    <span className="text-[11px] text-slate-500 font-medium">Avaliações</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-lg font-black text-slate-800 block">{data.lessons?.length || 0}</span>
                    <span className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400" /> Aulas dadas
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
                    <span className="text-lg font-black text-purple-700 block">{data.bookAssignments?.length || 0}</span>
                    <span className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                      <BookOpen className="w-3 h-3 text-purple-500" /> Livros/Vistos
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Trigger Card */}
              <div className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-sm font-bold text-indigo-950">Salvar Backup Direto no Google Drive</h4>
                  <p className="text-xs text-indigo-800 leading-relaxed max-w-md">
                    {hasDriveToken
                      ? `Cria um arquivo JSON completo no Google Drive de ${googleAccount?.email || 'sua conta Google conectada'}.`
                      : 'Autorize sua conta Google e envie um arquivo JSON completo com data e hora para o seu Google Drive.'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleUploadBackup}
                    disabled={isLoading || isLoggingIn}
                    className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 active:scale-95 transition disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                  >
                    <Upload className={`w-4 h-4 ${isLoading ? 'animate-bounce' : ''}`} />
                    <span>{isLoading ? 'Enviando...' : 'Fazer Backup Agora'}</span>
                  </button>
                </div>
              </div>

              {/* Local Offline Backup Alternative */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-center sm:text-left">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-1.5">
                    <FileJson className="w-4 h-4 text-emerald-600" />
                    <span>Cópia de Segurança Offline (.json)</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Baixe o arquivo completo diretamente para este computador ou celular sem depender de pop-ups.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLocalJsonDownload}
                  className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Baixar Arquivo .json</span>
                </button>
              </div>

              {/* Security info */}
              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                🔒 <strong>Privacidade e Segurança:</strong> O aplicativo só acessa e manipula os arquivos de backup que ele mesmo cria no seu Google Drive com sua autorização. Seus arquivos pessoais e pastas continuam 100% privados e intactos.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header and Refresh */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Backups Disponíveis no seu Google Drive</h4>
                  <p className="text-[11px] text-slate-500">
                    {hasDriveToken
                      ? `Exibindo arquivos de ${googleAccount?.email || 'sua conta Google conectada'}`
                      : 'Conecte sua conta Google para listar e restaurar seus arquivos de backup'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadBackups}
                  disabled={isLoading || isLoggingIn}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{hasDriveToken ? 'Atualizar Lista' : 'Conectar e Buscar'}</span>
                </button>
              </div>

              {/* Backups List or Connect Prompt */}
              {isLoading && !backups.length ? (
                <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span>{loadingAction || 'Buscando arquivos no Google Drive...'}</span>
                </div>
              ) : !hasDriveToken && backups.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">Conecte sua Conta Google para ver seus Backups</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Clique no botão abaixo para autorizar o acesso seguro aos arquivos de backup salvos no seu Google Drive.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    {renderGoogleSignInButton('Entrar com o Google', true)}
                    <button
                      type="button"
                      onClick={() => handleConnectGoogle({ forceAccountSelect: true, preferDirectOAuth: true, loadListAfter: true })}
                      disabled={isLoggingIn || isLoading}
                      className="px-3.5 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                    >
                      OAuth Direto
                    </button>
                  </div>
                </div>
              ) : backups.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6">
                  <HardDrive className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Nenhum backup encontrado nesta conta Google</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Você ainda não salvou nenhum backup em <strong>{googleAccount?.email || 'sua conta'}</strong>. Vá até a aba "Fazer Backup no Drive" e clique em "Fazer Backup Agora" ou clique em "Trocar Conta" acima.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {backups.map(file => {
                    const modDate = file.modifiedTime ? new Date(file.modifiedTime) : null;
                    const dateFormatted = modDate
                      ? `${modDate.toLocaleDateString('pt-BR')} às ${modDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Data desconhecida';

                    return (
                      <div
                        key={file.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                              <HardDrive className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate block" title={file.name}>
                              {file.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5 pl-8">
                            <span>📅 {dateFormatted}</span>
                            <span>📦 {file.size || 'JSON'}</span>
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
                                title="Abrir no Google Drive"
                              >
                                Ver no Drive <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-8 sm:pl-0">
                          <button
                            type="button"
                            onClick={() => setConfirmRestoreFile(file)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Restaurar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFile(file)}
                            disabled={isLoading}
                            title="Excluir este backup do Google Drive"
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{loadingAction || (isLoggingIn ? 'Aguardando autorização na janela do Google...' : 'Google Drive Sync v2')}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Confirmation Dialog: Restore from Google Drive (Mandatory Confirmation) */}
      {confirmRestoreFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-50 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Confirmar Restauração de Dados?</h4>
                <p className="text-xs text-slate-500">Google Drive &gt; Diário do Professor</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você está prestes a restaurar o backup <strong>"{confirmRestoreFile.name}"</strong>. Os dados atuais deste aparelho serão atualizados com as turmas, alunos, notas, frequências, ocorrências e correções de livros gravados nesse backup.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreFile(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleExecuteRestore(confirmRestoreFile)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Sim, Restaurar Dados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete from Google Drive (Mandatory Confirmation) */}
      {confirmDeleteFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Excluir Arquivo do Google Drive?</h4>
                <p className="text-xs text-slate-500">Esta ação não poderá ser desfeita</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja realmente remover o arquivo <strong>"{confirmDeleteFile.name}"</strong> do seu Google Drive?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteFile(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFile(confirmDeleteFile)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
