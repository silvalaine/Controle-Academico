import { User, UserRole } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const USERS_STORAGE_KEY = 'diario_professor_users_v1';
const USERS_MIRROR_KEY = 'diario_users_backup_mirror_v1';
const USERS_SNAPSHOTS_KEY = 'diario_users_history_snapshots_v1';
const SESSION_STORAGE_KEY = 'diario_professor_session_v1';

export interface UserSnapshot {
  id: string;
  timestamp: number;
  dateStr: string;
  source: string;
  userCount: number;
  users: User[];
}

/**
 * Saves a safety snapshot of users history in localStorage
 */
function recordUserSnapshot(users: User[], source: string = 'Edição manual'): void {
  try {
    if (!Array.isArray(users) || users.length === 0) return;
    const raw = localStorage.getItem(USERS_SNAPSHOTS_KEY);
    const snapshots: UserSnapshot[] = raw ? JSON.parse(raw) : [];
    
    // Don't record duplicate consecutive snapshot
    if (snapshots.length > 0) {
      const last = snapshots[snapshots.length - 1];
      if (JSON.stringify(last.users) === JSON.stringify(users)) {
        return;
      }
    }

    const now = new Date();
    const newSnapshot: UserSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      dateStr: now.toLocaleString('pt-BR'),
      source,
      userCount: users.length,
      users: JSON.parse(JSON.stringify(users))
    };

    // Keep up to 25 safety snapshots
    const updated = [...snapshots.slice(-24), newSnapshot];
    localStorage.setItem(USERS_SNAPSHOTS_KEY, JSON.stringify(updated));
    localStorage.setItem(USERS_MIRROR_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('Falha ao gravar snapshot de usuários:', err);
  }
}

export function getUserSnapshots(): UserSnapshot[] {
  try {
    const raw = localStorage.getItem(USERS_SNAPSHOTS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list.reverse(); // newest first
      }
    }
  } catch (_) {}
  return [];
}

export function restoreUserSnapshot(snapshotId: string): { success: boolean; users?: User[]; error?: string } {
  try {
    const raw = localStorage.getItem(USERS_SNAPSHOTS_KEY);
    if (!raw) return { success: false, error: 'Nenhum histórico de recuperação encontrado.' };
    const list: UserSnapshot[] = JSON.parse(raw);
    const found = list.find(s => s.id === snapshotId);
    if (!found || !Array.isArray(found.users) || found.users.length === 0) {
      return { success: false, error: 'Snapshot selecionado não contém usuários válidos.' };
    }

    saveRegisteredUsers(found.users);
    return { success: true, users: found.users };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao restaurar snapshot.' };
  }
}

// Simple deterministic salt + base64 encoding for local storage
export function hashPassword(password: string): string {
  const salt = 'dp_edu_salt_';
  return btoa(unescape(encodeURIComponent(salt + password.trim())));
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function suggestUsernameFromName(name: string): string {
  const cleaned = normalizeText(name)
    .replace(/^(prof\.?|professor(a)?|dr\.?|dra\.?|coord\.?)\s+/i, '')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');
  return cleaned || 'usuario';
}

function getDefaultUsernameForUser(u: User): string {
  if (u.username && u.username.trim()) {
    return u.username.trim().replace(/^@+/, '').toLowerCase();
  }
  const emailLower = (u.email || '').trim().toLowerCase();
  if (emailLower === 'admin@escola.com' || u.id === 'user-admin-1') {
    return 'admin';
  }
  if (emailLower === 'professor@escola.com' || u.id === 'user-prof-1') {
    return 'professor';
  }
  if (emailLower && emailLower.includes('@') && !emailLower.endsWith('@escola.local')) {
    return emailLower.split('@')[0].trim().toLowerCase();
  }
  return suggestUsernameFromName(u.name);
}

function hydrateUser(u: User): User {
  const username = getDefaultUsernameForUser(u);
  const email = u.email && u.email.trim() ? u.email.trim() : `${username}@escola.local`;
  const rawRole = String(u.role || '').trim().toLowerCase();
  const normalizedRole: UserRole =
    rawRole === 'admin' ||
    rawRole === 'administrador' ||
    rawRole === 'administrator' ||
    email.toLowerCase() === 'admin@escola.com' ||
    username === 'admin'
      ? 'admin'
      : 'professor';
  return {
    ...u,
    role: normalizedRole,
    username,
    email
  };
}

export function findUserByIdentifier(users: User[], identifier: string): User | undefined {
  const raw = identifier.trim();
  if (!raw) return undefined;

  const cleanLower = raw.toLowerCase();
  const cleanHandle = cleanLower.startsWith('@') ? cleanLower.slice(1) : cleanLower;
  const cleanNormalized = normalizeText(raw);

  // 1. Exact match by username (with or without leading @)
  const byUsername = users.find(
    u => u.username && u.username.trim().toLowerCase() === cleanHandle
  );
  if (byUsername) return byUsername;

  // 2. Exact match by email
  const byEmail = users.find(
    u => u.email && u.email.trim().toLowerCase() === cleanLower
  );
  if (byEmail) return byEmail;

  // 3. Exact or accent-insensitive match by full name
  const byName = users.find(
    u => normalizeText(u.name) === cleanNormalized
  );
  if (byName) return byName;

  return undefined;
}

export const initialDefaultUsers: User[] = [
  {
    id: 'user-admin-1',
    name: 'Coordenação Pedagógica / Direção',
    username: 'admin',
    email: 'admin@escola.com',
    role: 'admin',
    roleLabel: 'Administrador do Sistema',
    schoolName: 'Escola Municipal Santos Dumont',
    phone: '(11) 99999-0001',
    passwordHash: hashPassword('admin123'),
    createdAt: '2026-01-01T08:00:00.000Z',
    lastLoginAt: '2026-02-01T10:00:00.000Z'
  },
  {
    id: 'user-prof-1',
    name: 'Prof. Carlos Eduardo Silva',
    username: 'professor',
    email: 'professor@escola.com',
    role: 'professor',
    roleLabel: 'Professor de Matemática',
    schoolName: 'Escola Municipal Santos Dumont',
    phone: '(11) 98765-4321',
    passwordHash: hashPassword('123456'),
    createdAt: '2026-01-15T08:00:00.000Z',
    lastLoginAt: '2026-02-01T10:00:00.000Z',
    assignedClassIds: ['class-9a', 'class-8b']
  }
];

export function getRegisteredUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hydrated = parsed.map(hydrateUser);
        // Ensure the admin account exists in the list
        const hasAdmin = hydrated.some(
          (u: User) =>
            u.role === 'admin' ||
            u.email.toLowerCase() === 'admin@escola.com' ||
            u.username?.toLowerCase() === 'admin'
        );
        if (!hasAdmin) {
          const merged = [initialDefaultUsers[0], ...hydrated];
          saveRegisteredUsers(merged);
          return merged;
        }
        return hydrated;
      }
    }

    // Try fallback mirror if main key was wiped
    const mirror = localStorage.getItem(USERS_MIRROR_KEY);
    if (mirror) {
      const parsedMirror = JSON.parse(mirror);
      if (Array.isArray(parsedMirror) && parsedMirror.length > 0) {
        const hydratedMirror = parsedMirror.map(hydrateUser);
        saveRegisteredUsers(hydratedMirror);
        return hydratedMirror;
      }
    }
  } catch (err) {
    console.error('Erro ao ler usuários do localStorage:', err);
  }

  // Seed default demo users if empty
  saveRegisteredUsers(initialDefaultUsers);
  return initialDefaultUsers;
}

export function saveRegisteredUsers(users: User[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    recordUserSnapshot(users, 'Salvamento de Usuários');
  } catch (err) {
    console.error('Erro ao salvar usuários no localStorage:', err);
  }
}

export function getCurrentUser(): User | null {
  try {
    // Purge persistent sessions to ensure starting on login screen when opening the link
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.error('Erro ao ler sessão do usuário:', err);
  }
  return null;
}

export function setCurrentUser(user: User | null): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    if (user) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Erro ao salvar sessão do usuário:', err);
  }
}

export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const roleLower = String(user.role || '').trim().toLowerCase();
  return Boolean(
    roleLower === 'admin' ||
      roleLower === 'administrador' ||
      roleLower === 'administrator' ||
      user.email?.trim().toLowerCase() === 'admin@escola.com' ||
      user.username?.trim().replace(/^@+/, '').toLowerCase() === 'admin'
  );
}

/**
 * Register user - RESTRICTED: Should only be performed by administrator
 */
export function registerUserByAdmin(data: {
  name: string;
  username?: string;
  email?: string;
  password: string;
  role: UserRole;
  roleLabel?: string;
  schoolName?: string;
  phone?: string;
  assignedClassIds?: string[];
}): { success: boolean; user?: User; error?: string } {
  const cleanName = data.name.trim();
  const rawUsername = (data.username || '').trim().replace(/^@+/, '').toLowerCase();
  const rawEmail = (data.email || '').trim().toLowerCase();

  if (!cleanName) {
    return { success: false, error: 'O nome completo é obrigatório.' };
  }
  if (rawUsername && /\s/.test(rawUsername)) {
    return {
      success: false,
      error: 'O nome de usuário não pode conter espaços. Use letras, números, ponto ou underline (ex: maria.silva).'
    };
  }
  if (rawEmail && !rawEmail.includes('@')) {
    return { success: false, error: 'Informe um e-mail válido ou deixe o campo em branco.' };
  }
  if (!data.password || data.password.length < 6) {
    return { success: false, error: 'A senha provisória deve conter no mínimo 6 caracteres.' };
  }

  const users = getRegisteredUsers();

  // Determine unique username
  let cleanUsername =
    rawUsername ||
    (rawEmail && rawEmail.includes('@') ? rawEmail.split('@')[0].trim().toLowerCase() : suggestUsernameFromName(cleanName));

  const usernameConflict = users.some(u => u.username?.toLowerCase() === cleanUsername);
  if (usernameConflict) {
    if (rawUsername) {
      return { success: false, error: 'Já existe um usuário cadastrado com este nome de usuário no sistema.' };
    }
    let suffix = 2;
    while (users.some(u => u.username?.toLowerCase() === `${cleanUsername}.${suffix}`)) {
      suffix++;
    }
    cleanUsername = `${cleanUsername}.${suffix}`;
  }

  // Determine email (optional if username is provided)
  let cleanEmail = rawEmail;
  if (cleanEmail) {
    const emailConflict = users.some(u => u.email.toLowerCase() === cleanEmail);
    if (emailConflict) {
      return { success: false, error: 'Já existe um usuário cadastrado com este e-mail no sistema.' };
    }
  } else {
    cleanEmail = `${cleanUsername}@escola.local`;
    let suffix = 2;
    while (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      cleanEmail = `${cleanUsername}.${suffix}@escola.local`;
      suffix++;
    }
  }

  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    username: cleanUsername,
    email: cleanEmail,
    role: data.role,
    roleLabel: data.roleLabel?.trim() || (data.role === 'admin' ? 'Administrador Escolar' : 'Professor(a)'),
    schoolName: data.schoolName?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
    passwordHash: hashPassword(data.password),
    createdAt: new Date().toISOString(),
    lastLoginAt: undefined,
    assignedClassIds: data.role === 'professor' ? data.assignedClassIds : undefined
  };

  const updatedUsers = [...users, newUser];
  saveRegisteredUsers(updatedUsers);

  return { success: true, user: newUser };
}

/**
 * Delete user - RESTRICTED: Only admin can delete users
 */
export function deleteUserByAdmin(userId: string, currentAdminId: string): { success: boolean; error?: string } {
  if (userId === currentAdminId) {
    return { success: false, error: 'Você não pode excluir sua própria conta enquanto estiver logado.' };
  }

  const users = getRegisteredUsers();
  const target = users.find(u => u.id === userId);
  if (!target) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  // Count remaining admins
  const admins = users.filter(u => u.role === 'admin');
  if (target.role === 'admin' && admins.length <= 1) {
    return { success: false, error: 'Não é possível excluir o único administrador do sistema.' };
  }

  const updated = users.filter(u => u.id !== userId);
  saveRegisteredUsers(updated);

  return { success: true };
}

export function loginUser(
  identifier: string,
  password: string
): { success: boolean; user?: User; error?: string } {
  const cleanIdentifier = identifier.trim();

  if (!cleanIdentifier || !password) {
    return { success: false, error: 'Por favor, preencha o nome de usuário (ou e-mail) e a senha.' };
  }

  const users = getRegisteredUsers();
  const foundUser = findUserByIdentifier(users, cleanIdentifier);

  if (!foundUser) {
    return {
      success: false,
      error: 'Usuário ou e-mail não encontrado no sistema. Entre em contato com o Administrador para cadastrar seu acesso.'
    };
  }

  if (!verifyPassword(password, foundUser.passwordHash)) {
    return { success: false, error: 'Senha incorreta. Tente novamente ou use a recuperação de senha.' };
  }

  // Update last login
  const updatedUser: User = {
    ...foundUser,
    lastLoginAt: new Date().toISOString()
  };

  const updatedList = users.map(u => (u.id === updatedUser.id ? updatedUser : u));
  saveRegisteredUsers(updatedList);
  setCurrentUser(updatedUser);

  return { success: true, user: updatedUser };
}

export function logoutUser(): void {
  setCurrentUser(null);
}

export function resetUserPassword(
  identifier: string,
  newPassword: string
): { success: boolean; error?: string } {
  const cleanIdentifier = identifier.trim();
  if (!cleanIdentifier || !newPassword) {
    return { success: false, error: 'Preencha o nome de usuário (ou e-mail) e a nova senha.' };
  }
  if (newPassword.length < 6) {
    return { success: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' };
  }

  const users = getRegisteredUsers();
  const matched = findUserByIdentifier(users, cleanIdentifier);
  const userIndex = matched ? users.findIndex(u => u.id === matched.id) : -1;

  if (userIndex === -1) {
    return { success: false, error: 'Nenhum usuário cadastrado com este nome de usuário ou e-mail foi encontrado.' };
  }

  users[userIndex].passwordHash = hashPassword(newPassword);
  saveRegisteredUsers(users);

  // If current session is this user, update it
  const current = getCurrentUser();
  if (current && current.id === users[userIndex].id) {
    setCurrentUser(users[userIndex]);
  }

  return { success: true };
}

export function updateUserProfile(
  userId: string,
  updates: Partial<Pick<User, 'name' | 'username' | 'email' | 'role' | 'roleLabel' | 'schoolName' | 'phone' | 'assignedClassIds'>>
): { success: boolean; user?: User; error?: string } {
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  const nextUpdates = { ...updates };

  if (nextUpdates.username !== undefined) {
    const cleanUsername = nextUpdates.username.trim().replace(/^@+/, '').toLowerCase();
    if (!cleanUsername) {
      return { success: false, error: 'O nome de usuário não pode ficar vazio.' };
    }
    if (/\s/.test(cleanUsername)) {
      return { success: false, error: 'O nome de usuário não pode conter espaços.' };
    }
    const usernameConflict = users.some(
      u => u.id !== userId && u.username?.toLowerCase() === cleanUsername
    );
    if (usernameConflict) {
      return { success: false, error: 'Este nome de usuário já está sendo utilizado por outro usuário.' };
    }
    nextUpdates.username = cleanUsername;
  }

  if (nextUpdates.email !== undefined) {
    const cleanEmail = nextUpdates.email.trim().toLowerCase();
    if (cleanEmail) {
      if (!cleanEmail.includes('@')) {
        return { success: false, error: 'Informe um e-mail válido.' };
      }
      const conflict = users.some(u => u.id !== userId && u.email.toLowerCase() === cleanEmail);
      if (conflict) {
        return { success: false, error: 'Este e-mail já está sendo utilizado por outro usuário.' };
      }
      nextUpdates.email = cleanEmail;
    } else {
      const baseUsername =
        nextUpdates.username || users[idx].username || suggestUsernameFromName(nextUpdates.name || users[idx].name);
      nextUpdates.email = `${baseUsername}@escola.local`;
    }
  }

  const admins = users.filter(u => isAdmin(u));
  if (isAdmin(users[idx]) && nextUpdates.role === 'professor' && admins.length <= 1) {
    return {
      success: false,
      error: 'Não é possível alterar o perfil do único administrador do sistema para professor.'
    };
  }

  const updatedUser: User = hydrateUser({
    ...users[idx],
    ...nextUpdates,
    name: nextUpdates.name ? nextUpdates.name.trim() : users[idx].name
  });

  users[idx] = updatedUser;
  saveRegisteredUsers(users);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updatedUser);
  }

  return { success: true, user: updatedUser };
}

/**
 * Merges recovered or imported users into the active registered users list
 * without overwriting custom modifications, ensuring no duplicates by email/username/ID.
 */
export function mergeRecoveredUsers(incomingUsers: User[]): { updatedCount: number; totalUsers: User[] } {
  if (!Array.isArray(incomingUsers) || incomingUsers.length === 0) {
    return { updatedCount: 0, totalUsers: getRegisteredUsers() };
  }

  const current = getRegisteredUsers();
  const currentMap = new Map<string, User>();
  const emailMap = new Map<string, User>();
  const usernameMap = new Map<string, User>();

  current.forEach(u => {
    currentMap.set(u.id, u);
    if (u.email) emailMap.set(u.email.toLowerCase(), u);
    if (u.username) usernameMap.set(u.username.toLowerCase(), u);
  });

  let restoredCount = 0;

  incomingUsers.forEach(rawIncoming => {
    if (!rawIncoming || !rawIncoming.name || (!rawIncoming.email && !rawIncoming.username)) return;
    const incoming = hydrateUser(rawIncoming);
    const cleanEmail = incoming.email.toLowerCase();
    const cleanUsername = (incoming.username || '').toLowerCase();

    // Check if exists by ID, username, or email
    const existingById = currentMap.get(incoming.id);
    const existingByUsername = cleanUsername ? usernameMap.get(cleanUsername) : undefined;
    const existingByEmail = emailMap.get(cleanEmail);

    if (!existingById && !existingByUsername && !existingByEmail) {
      currentMap.set(incoming.id, incoming);
      emailMap.set(cleanEmail, incoming);
      if (cleanUsername) usernameMap.set(cleanUsername, incoming);
      restoredCount++;
    } else {
      // If existing exists but missing fields like username, assigned classes or phone, merge them
      const target = existingById || existingByUsername || existingByEmail!;
      let modified = false;
      if (!target.username && incoming.username) {
        target.username = incoming.username;
        modified = true;
      }
      if (!target.phone && incoming.phone) {
        target.phone = incoming.phone;
        modified = true;
      }
      if (!target.schoolName && incoming.schoolName) {
        target.schoolName = incoming.schoolName;
        modified = true;
      }
      if ((!target.assignedClassIds || target.assignedClassIds.length === 0) && (incoming.assignedClassIds && incoming.assignedClassIds.length > 0)) {
        target.assignedClassIds = incoming.assignedClassIds;
        modified = true;
      }
      if (modified) {
        currentMap.set(target.id, target);
        restoredCount++;
      }
    }
  });

  const mergedList = Array.from(currentMap.values());
  saveRegisteredUsers(mergedList);

  return { updatedCount: restoredCount, totalUsers: mergedList };
}

/**
 * Performs a deep scan across multiple Firestore sync documents and keys
 * to recover any user registration data that was stored in the cloud.
 */
export async function recoverUsersFromCloud(emailsToCheck?: string[]): Promise<{
  success: boolean;
  foundUsers: User[];
  restoredCount: number;
  message: string;
  sources: string[];
}> {
  const candidateEmails = new Set<string>();
  
  // Always include default channels
  candidateEmails.add('lab.tecnologia.amparo@gmail.com');
  
  try {
    const savedEmail = localStorage.getItem('diario_cloud_sync_email_v1');
    if (savedEmail && savedEmail.includes('@')) {
      candidateEmails.add(savedEmail.trim().toLowerCase());
    }
  } catch (_) {}

  if (Array.isArray(emailsToCheck)) {
    emailsToCheck.forEach(e => {
      if (e && e.includes('@')) candidateEmails.add(e.trim().toLowerCase());
    });
  }

  const collectedUsers: User[] = [];
  const foundSources: string[] = [];

  for (const email of candidateEmails) {
    const sanitized = email.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const userDocKeys = [
      `users_${sanitized}`,
      `users_${email}`,
      `sync_${sanitized}`
    ];

    for (const key of userDocKeys) {
      try {
        const snap = await getDoc(doc(db, 'diary_sync', key));
        if (snap.exists()) {
          const d = snap.data();
          if (d && d.payloadJson) {
            const parsed = JSON.parse(d.payloadJson);
            
            // If it is directly an array of Users
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.role) {
              parsed.forEach((u: any) => {
                if (u && u.name && (u.username || u.email)) collectedUsers.push(u);
              });
              foundSources.push(`Nuvem Firestore: documento "${key}" (${parsed.length} usuários)`);
            }
            // If it is AppDataState containing users or other metadata
            else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.users)) {
              parsed.users.forEach((u: any) => {
                if (u && u.name && (u.username || u.email)) collectedUsers.push(u);
              });
              foundSources.push(`Nuvem Firestore: payload "${key}" (${parsed.users.length} usuários)`);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[UserRecovery] Leitura em ${key}:`, err?.message || err);
      }
    }
  }

  // Also check snapshots from local storage
  const snapshots = getUserSnapshots();
  if (snapshots.length > 0) {
    const mostPopulous = snapshots.reduce((prev, curr) => (curr.userCount > prev.userCount ? curr : prev), snapshots[0]);
    if (mostPopulous && mostPopulous.users) {
      mostPopulous.users.forEach(u => collectedUsers.push(u));
      foundSources.push(`Snapshots Locais: histórico de ${mostPopulous.dateStr} (${mostPopulous.userCount} usuários)`);
    }
  }

  if (collectedUsers.length === 0) {
    return {
      success: false,
      foundUsers: [],
      restoredCount: 0,
      message: 'Nenhum cadastro de usuário foi encontrado nos canais de nuvem ou histórico recente.',
      sources: foundSources
    };
  }

  const { updatedCount, totalUsers } = mergeRecoveredUsers(collectedUsers);

  return {
    success: true,
    foundUsers: totalUsers,
    restoredCount: updatedCount,
    message: updatedCount > 0
      ? `Recuperação concluída com sucesso! ${updatedCount} cadastro(s) recuperados e mesclados.`
      : `Todos os ${totalUsers.length} cadastros encontrados já estão ativos e sincronizados.`,
    sources: foundSources
  };
}
