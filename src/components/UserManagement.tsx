import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Search,
  Mail,
  School,
  BookOpen,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Calendar,
  Layers,
  CheckSquare,
  RotateCcw,
  AtSign,
  Edit2
} from 'lucide-react';
import { User, UserRole, ClassRoom } from '../types';
import {
  getRegisteredUsers,
  registerUserByAdmin,
  deleteUserByAdmin,
  resetUserPassword,
  updateUserProfile,
  suggestUsernameFromName
} from '../utils/auth';
import { pushUsersToCloud } from '../utils/cloudSync';
import { ConfirmModal } from './ConfirmModal';
import { UserRecoveryModal } from './UserRecoveryModal';

interface UserManagementProps {
  currentUser: User;
  classes?: ClassRoom[];
  onUsersChange?: () => void;
  onCurrentUserUpdated?: (updatedUser: User) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUser,
  classes = [],
  onUsersChange,
  onCurrentUserUpdated
}) => {
  const [users, setUsers] = useState<User[]>(() => getRegisteredUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'professor'>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToResetPass, setUserToResetPass] = useState<User | null>(null);
  const [userToEditClasses, setUserToEditClasses] = useState<User | null>(null);
  const [editClassesIds, setEditClassesIds] = useState<string[]>([]);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  // Form: Edit User
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('professor');
  const [editRoleLabel, setEditRoleLabel] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Form: New User
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [isUsernameManuallyEdited, setIsUsernameManuallyEdited] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('professor');
  const [newRoleLabel, setNewRoleLabel] = useState('Professor(a) de ');
  const [newSchool, setNewSchool] = useState('Escola Municipal Santos Dumont');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // Form: Reset Password
  const [newPassInput, setNewPassInput] = useState('123456');

  // Notification banners
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshUsers = () => {
    const list = getRegisteredUsers();
    setUsers(list);
    pushUsersToCloud(list).catch(() => {});
    if (onUsersChange) onUsersChange();
  };

  const handleOpenAdd = () => {
    setNewName('');
    setNewUsername('');
    setIsUsernameManuallyEdited(false);
    setNewEmail('');
    setNewRole('professor');
    setNewRoleLabel('Professor(a) de ');
    setNewSchool(currentUser.schoolName || 'Escola Municipal');
    setNewPhone('');
    setNewPassword('123456');
    setSelectedClassIds([]);
    setErrorMsg(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditClasses = (user: User) => {
    setUserToEditClasses(user);
    setEditClassesIds(user.assignedClassIds || []);
  };

  const handleOpenEditUser = (user: User) => {
    setErrorMsg(null);
    setUserToEdit(user);
    setEditName(user.name);
    setEditUsername(user.username || suggestUsernameFromName(user.name));
    setEditEmail(user.email.endsWith('@escola.local') ? '' : user.email);
    setEditRole(user.role);
    setEditRoleLabel(user.roleLabel || (user.role === 'admin' ? 'Administrador Escolar' : 'Professor(a)'));
    setEditSchool(user.schoolName || '');
    setEditPhone(user.phone || '');
  };

  const handleSaveEditedUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setErrorMsg(null);

    const res = updateUserProfile(userToEdit.id, {
      name: editName,
      username: editUsername,
      email: editEmail,
      role: editRole,
      roleLabel: editRoleLabel,
      schoolName: editSchool,
      phone: editPhone
    });

    if (res.success && res.user) {
      setSuccessMsg(`Dados de "${res.user.name}" (@${res.user.username}) atualizados com sucesso!`);
      if (res.user.id === currentUser.id && onCurrentUserUpdated) {
        onCurrentUserUpdated(res.user);
      }
      setUserToEdit(null);
      refreshUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'Erro ao atualizar dados do usuário.');
    }
  };

  const handleSaveTeacherClasses = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEditClasses) return;

    const res = updateUserProfile(userToEditClasses.id, {
      assignedClassIds: editClassesIds
    });

    if (res.success) {
      setSuccessMsg(`Turmas do professor(a) "${userToEditClasses.name}" atualizadas com sucesso!`);
      setUserToEditClasses(null);
      refreshUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'Erro ao atualizar turmas do professor.');
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const result = registerUserByAdmin({
      name: newName,
      username: newUsername,
      email: newEmail,
      password: newPassword,
      role: newRole,
      roleLabel: newRoleLabel,
      schoolName: newSchool,
      phone: newPhone,
      assignedClassIds: newRole === 'professor' ? selectedClassIds : undefined
    });

    if (result.success && result.user) {
      setSuccessMsg(
        `Usuário "${result.user.name}" (@${result.user.username}) cadastrado com sucesso!`
      );
      setIsAddModalOpen(false);
      refreshUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(result.error || 'Falha ao cadastrar usuário.');
    }
  };

  const handleDeleteUser = () => {
    if (!userToDelete) return;
    const res = deleteUserByAdmin(userToDelete.id, currentUser.id);
    if (res.success) {
      setSuccessMsg(`Usuário "${userToDelete.name}" foi removido do sistema.`);
      setUserToDelete(null);
      refreshUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'Não foi possível excluir o usuário.');
      setUserToDelete(null);
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToResetPass) return;
    const res = resetUserPassword(userToResetPass.username || userToResetPass.email, newPassInput);
    if (res.success) {
      setSuccessMsg(`Senha do usuário "${userToResetPass.name}" redefinida para "${newPassInput}".`);
      setUserToResetPass(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'Erro ao redefinir senha.');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchUsername = (u.username || '').toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchRole = (u.roleLabel || u.role).toLowerCase().includes(q);
      if (!matchName && !matchUsername && !matchEmail && !matchRole) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Gestão de Usuários & Professores
            </h3>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full">
              {users.length} cadastrados
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de acessos exclusivo do Administrador: cadastre novos professores, defina permissões e redefina senhas.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsRecoveryModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            title="Recuperar cadastros da nuvem ou histórico de snapshots"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            <span>Recuperar Cadastros</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, usuário, e-mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-semibold mr-1">Filtrar:</span>
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              roleFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              roleFilter === 'admin'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Administradores ({users.filter((u) => u.role === 'admin').length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('professor')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              roleFilter === 'professor'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Professores ({users.filter((u) => u.role === 'professor').length})
          </button>
        </div>
      </div>

      {/* Users List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredUsers.map((u) => {
          const isCurrent = u.id === currentUser.id;
          const isAdminUser = u.role === 'admin';

          return (
            <div
              key={u.id}
              className={`bg-white rounded-2xl p-4 border transition shadow-xs flex flex-col justify-between ${
                isCurrent ? 'border-indigo-300 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        isAdminUser
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          {u.name}
                        </h4>
                        {isCurrent && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 mt-1">
                        <span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          @{u.username || suggestUsernameFromName(u.name)}
                        </span>
                        {u.email && !u.email.endsWith('@escola.local') && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{u.email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isAdminUser
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isAdminUser ? (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{isAdminUser ? 'Administrador' : 'Professor'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
                  <div className="flex items-center gap-1.5 truncate">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{u.roleLabel || u.role}</span>
                  </div>
                  {u.schoolName && (
                    <div className="flex items-center gap-1.5 truncate">
                      <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{u.schoolName}</span>
                    </div>
                  )}
                  {u.phone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{u.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Cadastrado em {new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                {/* Professor Assigned Classes Information */}
                {!isAdminUser && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] bg-indigo-50/40 px-2.5 py-1.5 rounded-xl border border-indigo-100/60 mb-2">
                    <div className="flex items-center gap-1.5 text-slate-700 truncate">
                      <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-bold">Turmas:</span>
                      {(!u.assignedClassIds || u.assignedClassIds.length === 0) ? (
                        <span className="bg-emerald-100/80 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Todas liberadas ({classes.length})
                        </span>
                      ) : (
                        <span
                          className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-[130px]"
                          title={classes.filter(c => u.assignedClassIds?.includes(c.id)).map(c => c.name).join(', ')}
                        >
                          {u.assignedClassIds.length} turma(s) permitida(s)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEditClasses(u)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline shrink-0 ml-2 cursor-pointer"
                    >
                      Alterar Turmas
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenEditUser(u)}
                    className="flex items-center gap-1 text-slate-700 hover:text-indigo-700 font-semibold p-1 cursor-pointer"
                    title="Editar dados, usuário ou perfil deste usuário"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUserToResetPass(u);
                      setNewPassInput('123456');
                    }}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold p-1 cursor-pointer"
                    title="Redefinir senha de acesso deste usuário"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Redefinir Senha</span>
                  </button>
                </div>

                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => setUserToDelete(u)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title={`Excluir usuário ${u.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Cadastrar Novo Usuário */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Cadastrar Novo Usuário no Sistema
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prof. Roberto Miranda"
                  value={newName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewName(val);
                    if (!isUsernameManuallyEdited) {
                      setNewUsername(val.trim() ? suggestUsernameFromName(val) : '');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nome de Usuário (Login) *
                  </label>
                  <div className="relative">
                    <AtSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: roberto.miranda"
                      value={newUsername}
                      onChange={(e) => {
                        setIsUsernameManuallyEdited(true);
                        setNewUsername(e.target.value.replace(/\s+/g, '').toLowerCase());
                      }}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Usado para acessar o sistema.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    E-mail (Opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="roberto.miranda@escola.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Opcional se o login for por usuário.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tipo de Perfil *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setNewRole(r);
                      if (r === 'admin') {
                        setNewRoleLabel('Administrador(a) Escolar');
                      } else {
                        setNewRoleLabel('Professor(a) de ');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    <option value="professor">Professor(a)</option>
                    <option value="admin">Administrador(a)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Disciplina / Função *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Geografia, Coordenação..."
                    value={newRoleLabel}
                    onChange={(e) => setNewRoleLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Escola / Unidade
                  </label>
                  <input
                    type="text"
                    placeholder="Nome da escola"
                    value={newSchool}
                    onChange={(e) => setNewSchool(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Telefone (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Classes Assignment for Professor */}
              {newRole === 'professor' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Turmas que o Professor pode Acessar:
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedClassIds(classes.map(c => c.id))}
                        className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                      >
                        Todas
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedClassIds([])}
                        className="text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {classes.length === 0 ? (
                      <p className="text-slate-400 text-xs italic">Nenhuma turma cadastrada no sistema.</p>
                    ) : (
                      classes.map((cls) => {
                        const isChecked = selectedClassIds.includes(cls.id);
                        return (
                          <label
                            key={cls.id}
                            className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                              isChecked
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedClassIds(prev => [...prev, cls.id]);
                                  } else {
                                    setSelectedClassIds(prev => prev.filter(id => id !== cls.id));
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                              <span>{cls.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {cls.gradeLevel} • Turno {cls.shift}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    {selectedClassIds.length === 0
                      ? 'ℹ️ Se nenhuma for marcada, o professor terá acesso a todas as turmas da escola.'
                      : `✓ ${selectedClassIds.length} turma(s) selecionada(s) com acesso liberado.`}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Senha Provisória de Acesso * (mín. 6 dígitos)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  O usuário poderá alterar esta senha a qualquer momento através do seu perfil.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerenciar Turmas Permitidas do Professor */}
      {userToEditClasses && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Turmas Permitidas do Professor
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {userToEditClasses.name} ({userToEditClasses.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToEditClasses(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacherClasses} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Selecione as turmas que este professor pode acessar:
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEditClassesIds(classes.map(c => c.id))}
                    className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                  >
                    Todas
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setEditClassesIds([])}
                    className="text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                  >
                    Nenhuma
                  </button>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-2 pr-1 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                {classes.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">Nenhuma turma cadastrada no sistema.</p>
                ) : (
                  classes.map((cls) => {
                    const isChecked = editClassesIds.includes(cls.id);
                    return (
                      <label
                        key={cls.id}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditClassesIds(prev => [...prev, cls.id]);
                              } else {
                                setEditClassesIds(prev => prev.filter(id => id !== cls.id));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <span>{cls.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {cls.gradeLevel} • Turno {cls.shift}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[11px] text-indigo-900">
                {editClassesIds.length === 0 ? (
                  <span>⚠️ Sem restrição específica: o professor poderá ver <strong>todas as turmas</strong> da escola.</span>
                ) : (
                  <span>✓ O professor só poderá visualizar e lançar notas nestas <strong>{editClassesIds.length} turma(s) selecionada(s)</strong>.</span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserToEditClasses(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Salvar Permissões de Turmas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Redefinir Senha */}
      {userToResetPass && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              Redefinir Senha de Acesso
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Informe a nova senha para o usuário <strong>{userToResetPass.name}</strong> (@{userToResetPass.username || suggestUsernameFromName(userToResetPass.name)}):
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nova Senha *
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToResetPass(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excluir Usuário */}
      <ConfirmModal
        isOpen={!!userToDelete}
        title="Excluir Usuário do Sistema?"
        message={`Deseja realmente remover o acesso de "${userToDelete?.name}" (@${userToDelete?.username || ''})? Este usuário não poderá mais acessar o diário.`}
        confirmLabel="Sim, Excluir Usuário"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      {/* Modal: Editar Usuário */}
      {userToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Editar Cadastro de Usuário
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUserToEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedUser} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nome de Usuário (Login) *
                  </label>
                  <div className="relative">
                    <AtSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    E-mail (Opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="usuario@escola.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tipo de Perfil *
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    <option value="professor">Professor(a)</option>
                    <option value="admin">Administrador(a)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Disciplina / Função
                  </label>
                  <input
                    type="text"
                    value={editRoleLabel}
                    onChange={(e) => setEditRoleLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Escola / Unidade
                  </label>
                  <input
                    type="text"
                    value={editSchool}
                    onChange={(e) => setEditSchool(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Telefone (Opcional)
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Recuperação de Cadastros */}
      <UserRecoveryModal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        currentUser={currentUser}
        onUsersChanged={refreshUsers}
      />
    </div>
  );
};
