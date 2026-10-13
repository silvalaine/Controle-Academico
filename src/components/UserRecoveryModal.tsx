import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Cloud,
  History,
  Users,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Trash2,
  HardDrive,
  ShieldCheck,
  UserCheck,
  Search,
  ArrowRight
} from 'lucide-react';
import { User, Student, ClassRoom } from '../types';
import {
  getRegisteredUsers,
  getUserSnapshots,
  restoreUserSnapshot,
  recoverUsersFromCloud,
  mergeRecoveredUsers,
  UserSnapshot
} from '../utils/auth';
import {
  getDeletedIds,
  clearDeletedId,
  restoreAllDeletedItems,
  loadStoredData,
  AppDataState
} from '../utils/storage';
import { getSyncEmail } from '../utils/cloudSync';

interface UserRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onUsersChanged?: () => void;
  onDataChanged?: (newData: AppDataState) => void;
  onOpenGoogleDriveModal?: () => void;
}

export const UserRecoveryModal: React.FC<UserRecoveryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUsersChanged,
  onDataChanged,
  onOpenGoogleDriveModal
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'students' | 'history'>('users');
  const [currentUsers, setCurrentUsers] = useState<User[]>(() => getRegisteredUsers());
  const [snapshots, setSnapshots] = useState<UserSnapshot[]>(() => getUserSnapshots());

  // Cloud scan state
  const [isScanningCloud, setIsScanningCloud] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    restoredCount: number;
    message: string;
    sources: string[];
    foundUsers: User[];
  } | null>(null);

  // Deleted items state
  const [deletedStudentsCount, setDeletedStudentsCount] = useState(0);
  const [deletedClassesCount, setDeletedClassesCount] = useState(0);

  // Action status message
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentUsers(getRegisteredUsers());
      setSnapshots(getUserSnapshots());
      setDeletedStudentsCount(getDeletedIds('student').size);
      setDeletedClassesCount(getDeletedIds('class').size);
      setScanResult(null);
      setBannerMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const syncEmail = getSyncEmail();

  // Handler: Scan Firestore Cloud for users
  const handleScanCloud = async () => {
    setIsScanningCloud(true);
    setBannerMsg(null);
    try {
      const result = await recoverUsersFromCloud([syncEmail, 'lab.tecnologia.amparo@gmail.com']);
      setScanResult(result);
      if (result.success) {
        const updated = getRegisteredUsers();
        setCurrentUsers(updated);
        setSnapshots(getUserSnapshots());
        if (onUsersChanged) onUsersChanged();
        setBannerMsg({
          type: 'success',
          text: result.message
        });
      } else {
        setBannerMsg({
          type: 'info',
          text: result.message
        });
      }
    } catch (e: any) {
      setBannerMsg({
        type: 'error',
        text: 'Erro ao consultar a nuvem: ' + (e?.message || String(e))
      });
    } finally {
      setIsScanningCloud(false);
    }
  };

  // Handler: Restore specific snapshot
  const handleRestoreSnapshot = (snapId: string) => {
    const res = restoreUserSnapshot(snapId);
    if (res.success && res.users) {
      setCurrentUsers(res.users);
      setSnapshots(getUserSnapshots());
      if (onUsersChanged) onUsersChanged();
      setBannerMsg({
        type: 'success',
        text: `Versão restaurada com sucesso! ${res.users.length} usuários ativos.`
      });
    } else {
      setBannerMsg({
        type: 'error',
        text: res.error || 'Falha ao restaurar ponto de histórico.'
      });
    }
  };

  // Handler: Restore all deleted students/classes
  const handleRestoreAllDeleted = () => {
    const res = restoreAllDeletedItems();
    setDeletedStudentsCount(0);
    setDeletedClassesCount(0);
    const refreshedData = loadStoredData();
    if (onDataChanged) {
      onDataChanged(refreshedData);
    }
    setBannerMsg({
      type: 'success',
      text: `Restauração concluída! ${res.studentsRestored} alunos e ${res.classesRestored} turmas foram reativados na visualização.`
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Central de Recuperação de Cadastros</h2>
              <p className="text-xs text-indigo-200">
                Localize e restaure cadastros de usuários, professores e alunos da nuvem ou histórico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuários & Professores ({currentUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Snapshots Históricos ({snapshots.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
              activeTab === 'students'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Alunos Ocultados / Lixeira ({deletedStudentsCount + deletedClassesCount})</span>
          </button>
        </div>

        {/* Status Notification Banner */}
        {bannerMsg && (
          <div className={`p-3 text-xs font-semibold flex items-center gap-2 border-b ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : bannerMsg.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}>
            {bannerMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : bannerMsg.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span>{bannerMsg.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: USERS & TEACHERS */}
          {activeTab === 'users' && (
            <div className="space-y-5">
              {/* Cloud Auto Recovery Action */}
              <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-indigo-600" />
                      Varredura Automática da Nuvem (Firestore)
                    </h4>
                    <p className="text-xs text-indigo-800/80 mt-1">
                      Busca cadastros de usuários salvos nos canais da nuvem (incluindo{' '}
                      <span className="font-mono font-bold">{syncEmail}</span> e registros associados).
                    </p>
                  </div>

                  <button
                    onClick={handleScanCloud}
                    disabled={isScanningCloud}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningCloud ? 'animate-spin' : ''}`} />
                    <span>{isScanningCloud ? 'Buscando...' : 'Escanear e Restaurar'}</span>
                  </button>
                </div>

                {scanResult && scanResult.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-indigo-200/60 text-[11px] text-indigo-900">
                    <p className="font-bold mb-1">Locais analisados:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
                      {scanResult.sources.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Current Users List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Usuários Ativos no Dispositivo ({currentUsers.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Armazenamento seguro local + nuvem
                  </span>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50 max-h-56 overflow-y-auto">
                  {currentUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${
                          u.role === 'admin' ? 'bg-indigo-600' : 'bg-emerald-600'
                        }`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{u.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.role === 'admin'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {u.roleLabel || (u.role === 'admin' ? 'Administrador' : 'Professor')}
                        </span>
                        {u.phone && (
                          <span className="text-[10px] text-slate-400 hidden sm:inline">{u.phone}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notice about Roles & Permissions */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <p className="font-bold flex items-center gap-1.5 text-amber-900 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Importante: Visualização de Usuários no Sistema
                </p>
                <p className="text-[11px] leading-relaxed">
                  Por regra de privacidade escolar, a aba <strong>"Usuários / Acessos"</strong> só é exibida quando você está conectado como <strong>Administrador</strong> (<span className="font-mono">admin@escola.com</span>). Se você fizer login com uma conta de Professor, outros usuários não aparecerão na navegação para garantir a segurança dos acessos.
                </p>
              </div>

              {/* Google Drive Fast Trigger */}
              {onOpenGoogleDriveModal && (
                <div className="p-3.5 bg-slate-900 rounded-xl text-white flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold">Possui cópia salva no Google Drive?</p>
                      <p className="text-[11px] text-slate-400">
                        Você pode importar diretamente do Google Drive com 1 clique
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenGoogleDriveModal();
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs rounded-lg transition shrink-0 cursor-pointer"
                  >
                    Abrir Drive
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HISTORICAL SNAPSHOTS */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  Snapshots Automáticos de Segurança
                </p>
                <p className="text-[11px]">
                  O aplicativo gera automaticamente cópias de segurança a cada alteração ou sincronização. Caso tenha perdido cadastros recentes, escolha um ponto no tempo abaixo para restaurá-los:
                </p>
              </div>

              {snapshots.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhum snapshot gravado ainda neste navegador. Novos pontos serão criados automaticamente.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-indigo-300 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{snap.dateStr}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            {snap.source}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {snap.userCount} usuário(s) gravados • Exemplo: {snap.users?.[0]?.name || 'N/A'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRestoreSnapshot(snap.id)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs rounded-lg border border-indigo-200 hover:border-transparent transition shrink-0 cursor-pointer"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DELETED STUDENTS / RECYCLE BIN */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Alunos e Turmas Ocultados por Exclusão
                </p>
                <p className="text-[11px] leading-relaxed">
                  Quando um aluno ou turma é excluído, o sistema mantém uma proteção de sincronização para evitar conflitos na nuvem. Se algum cadastro de estudante sumiu da sua lista, você pode limpar as exclusões e restaurá-los imediatamente.
                </p>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {deletedStudentsCount + deletedClassesCount > 0
                      ? `${deletedStudentsCount} aluno(s) e ${deletedClassesCount} turma(s) marcados como excluídos`
                      : 'Nenhum aluno ou turma está na lista de exclusão'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clique abaixo para reativar todos os cadastros no diário
                  </p>
                </div>

                <button
                  onClick={handleRestoreAllDeleted}
                  disabled={deletedStudentsCount + deletedClassesCount === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0 shadow-xs"
                >
                  Restaurar Todos
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Diário do Professor • Proteção de Dados e Cadastros
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
