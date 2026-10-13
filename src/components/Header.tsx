import React, { useState } from 'react';
import {
  GraduationCap,
  Calendar,
  Layers,
  BookOpen,
  RotateCcw,
  Download,
  Upload,
  Clock,
  Award
} from 'lucide-react';
import { AcademicYear, ClassRoom, User } from '../types';
import { getTermCount, getTermLabel } from '../utils/calculations';
import { ConfirmModal } from './ConfirmModal';
import { UserProfileModal } from './UserProfileModal';
import { User as UserIcon, LogOut, ChevronDown, Cloud, RefreshCw, CheckCircle2, Edit2, AlertTriangle, HardDrive } from 'lucide-react';

export interface SyncStatusInfo {
  synced: boolean;
  syncing: boolean;
  lastDevice?: string;
  lastUpdated?: string;
  error?: string | null;
  isQuotaExceeded?: boolean;
}

interface HeaderProps {
  academicYears: AcademicYear[];
  selectedYearId: string;
  onSelectYear: (yearId: string) => void;
  classes: ClassRoom[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onEditClass?: (classRoom: ClassRoom) => void;
  selectedTerm: number;
  onSelectTerm: (term: number) => void;
  onResetData: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currentUser?: User | null;
  onLogout?: () => void;
  onUserUpdated?: (user: User) => void;
  syncStatus?: SyncStatusInfo;
  onManualSync?: () => void;
  syncEmail?: string;
  onOpenSyncEmailModal?: () => void;
  onOpenGoogleDriveModal?: () => void;
  onShowQuotaAlert?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  academicYears,
  selectedYearId,
  onSelectYear,
  classes,
  selectedClassId,
  onSelectClass,
  onEditClass,
  selectedTerm,
  onSelectTerm,
  onResetData,
  onExportData,
  onImportData,
  currentUser,
  onLogout,
  onUserUpdated,
  syncStatus,
  onManualSync,
  syncEmail,
  onOpenSyncEmailModal,
  onOpenGoogleDriveModal,
  onShowQuotaAlert
}) => {
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const currentYear = academicYears.find(y => y.id === selectedYearId) || academicYears[0];
  const yearMatches = classes.filter(c => !selectedYearId || !c.academicYearId || c.academicYearId === selectedYearId);
  const filteredClasses = yearMatches.length > 0 ? yearMatches : classes;
  const currentClass = classes.find(c => c.id === selectedClassId) || filteredClasses[0] || null;

  const termCount = currentClass ? getTermCount(currentClass.termType) : 4;

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 relative z-10 shadow-md print:hidden">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Diário do Professor</h1>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 font-medium px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Gestão Escolar
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Acompanhamento pedagógico, notas, frequência e BNCC
              </p>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Sincronizar Button - On Demand Trigger */}
            {onManualSync && (
              <button
                type="button"
                onClick={onManualSync}
                disabled={syncStatus?.syncing}
                title="Sincronizar dados deste aparelho com a nuvem"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-xs ${
                  syncStatus?.syncing
                    ? 'bg-amber-600 text-white cursor-wait'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus?.syncing ? 'animate-spin' : ''}`} />
                <span>{syncStatus?.syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            )}

            {/* Cloud Channel Email Chip */}
            <button
              type="button"
              onClick={onOpenSyncEmailModal}
              title={
                syncStatus?.isQuotaExceeded
                  ? 'Cota diária gratuita do Firestore atingida hoje. Todos os seus dados estão salvos com segurança localmente neste aparelho. Clique para detalhes.'
                  : `Canal da Nuvem: ${syncEmail || 'lab.tecnologia.amparo@gmail.com'}. Clique para alterar o e-mail ou gerenciar a sincronização.`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition cursor-pointer ${
                syncStatus?.isQuotaExceeded
                  ? 'bg-amber-950/40 border-amber-600/50 text-amber-200'
                  : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-300'
              }`}
            >
              <div className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncStatus?.isQuotaExceeded ? 'bg-amber-400' : syncStatus?.syncing ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${syncStatus?.isQuotaExceeded ? 'bg-amber-500' : syncStatus?.syncing ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              </div>
              <Cloud className={`w-3.5 h-3.5 ${syncStatus?.isQuotaExceeded ? 'text-amber-400' : 'text-indigo-400'}`} />
              <span className="text-[11px] font-mono max-w-[130px] truncate text-slate-200">
                {syncStatus?.isQuotaExceeded ? 'Cota Diária' : (syncEmail || 'lab.tecnologia.amparo@gmail.com')}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Logged User Chip */}
            {currentUser && (
              <div className="flex items-center gap-1.5 bg-slate-800/90 pl-1.5 pr-2 py-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 text-left hover:opacity-90 transition cursor-pointer"
                  title="Ver perfil e dados do usuário"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block leading-tight">
                    <span className="font-bold text-white text-xs block max-w-[120px] truncate">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] text-indigo-300 block truncate max-w-[120px]">
                      {currentUser.role}
                    </span>
                  </div>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => setIsLogoutConfirmOpen(true)}
                    title="Encerrar sessão (Sair)"
                    className="ml-1 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Quota Exceeded Warning Badge */}
            {syncStatus?.isQuotaExceeded && (
              <button
                type="button"
                onClick={onShowQuotaAlert || onOpenGoogleDriveModal}
                title="Atenção: Limite diário de sincronização em nuvem atingido. Seus dados continuam 100% seguros localmente! Clique para ver aviso ou fazer backup no Google Drive."
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-bold text-xs animate-pulse transition cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Cota Excedida</span>
                <span className="sm:hidden">Cota</span>
              </button>
            )}

            {/* Google Drive Direct Backup & Restore Button */}
            {onOpenGoogleDriveModal && (
              <button
                type="button"
                onClick={onOpenGoogleDriveModal}
                title="Fazer backup ou restaurar direto no Google Drive do e-mail ativo"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-300 font-semibold transition cursor-pointer shadow-2xs hover:border-emerald-500"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                <span className="hidden sm:inline">Google Drive</span>
                <span className="sm:hidden">Drive</span>
              </button>
            )}

            <button
              onClick={onExportData}
              title="Exportar backup dos dados em JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Backup</span>
              <span className="sm:hidden">JSON</span>
            </button>

            <label
              title="Importar backup em JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              <span>Importar</span>
              <input type="file" accept=".json" onChange={onImportData} className="hidden" />
            </label>

            <button
              onClick={() => setIsResetConfirmOpen(true)}
              title="Restaurar dados de exemplo"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurar Padrão</span>
            </button>
          </div>
        </div>

        {/* Global Selectors Bar (Year, Class, Term) */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <label htmlFor="year-select" className="text-xs text-slate-400 font-medium">Ano:</label>
              <select
                id="year-select"
                value={selectedYearId}
                onChange={(e) => onSelectYear(e.target.value)}
                className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
              >
                {academicYears.map(year => (
                  <option key={year.id} value={year.id} className="bg-slate-900 text-white">
                    {year.title} {year.isActive ? '(Ativo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
              <Layers className="w-4 h-4 text-blue-400" />
              <label htmlFor="class-select" className="text-xs text-slate-400 font-medium">Turma:</label>
              <select
                id="class-select"
                value={selectedClassId}
                onChange={(e) => onSelectClass(e.target.value)}
                className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
              >
                {filteredClasses.length === 0 && (
                  <option value="" className="bg-slate-900 text-white">Nenhuma turma cadastrada</option>
                )}
                {filteredClasses.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name} - {c.subject} ({c.shift})
                  </option>
                ))}
              </select>

              {currentClass && onEditClass && (
                <button
                  type="button"
                  onClick={() => onEditClass(currentClass)}
                  title={`Editar turma ${currentClass.name}`}
                  className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white border border-indigo-400/30 text-[11px] font-semibold transition cursor-pointer"
                >
                  <Edit2 className="w-3 h-3 text-indigo-400" />
                  <span className="hidden md:inline">Editar</span>
                </button>
              )}
            </div>

            {/* Class Details Pill */}
            {currentClass && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  {currentClass.gradeLevel}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Turno {currentClass.shift}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Award className="w-3.5 h-3.5" />
                  Média de aprovação: {currentClass.passingGrade.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Period (Bimestre / Trimestre) Pills */}
          {currentClass && (
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700/80">
              {Array.from({ length: termCount }).map((_, idx) => {
                const termNum = idx + 1;
                const isSelected = selectedTerm === termNum;
                return (
                  <button
                    key={termNum}
                    onClick={() => onSelectTerm(termNum)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    {getTermLabel(currentClass.termType, termNum)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Restaurar Dados Originais de Exemplo?"
        message="Atenção: Todas as notas, turmas, alunos e registros atuais serão substituídos pelo modelo inicial padrão. Esta ação não pode ser desfeita."
        confirmLabel="Sim, Restaurar Dados"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          onResetData();
          setIsResetConfirmOpen(false);
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* Logout Confirmation Dialog */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        title="Encerrar Sessão?"
        message="Deseja realmente sair do sistema? Seus dados estão salvos e você precisará digitar sua senha novamente para acessar."
        confirmLabel="Sim, Sair"
        cancelLabel="Continuar no Sistema"
        isDestructive={true}
        onConfirm={() => {
          setIsLogoutConfirmOpen(false);
          if (onLogout) onLogout();
        }}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />

      {/* User Profile & Password Modal */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          user={currentUser}
          onClose={() => setIsProfileModalOpen(false)}
          onLogout={() => {
            setIsProfileModalOpen(false);
            if (onLogout) onLogout();
          }}
          onUserUpdated={(u) => {
            if (onUserUpdated) onUserUpdated(u);
          }}
        />
      )}
    </header>
  );
};
