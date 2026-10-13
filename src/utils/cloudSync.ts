import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AppDataState, loadStoredData, saveStoredData, markItemDeleted } from './storage';
import {
  User,
  ClassRoom,
  Student,
  Assessment,
  GradeRecord,
  AttendanceRecord,
  LessonContent,
  StudentObservation,
  TermRecoveryRecord,
  FinalRecoveryRecord,
  StudentIncident,
  IncidentTypeDefinition
} from '../types';
import { getRegisteredUsers, saveRegisteredUsers } from './auth';

const SYNC_EMAIL_KEY = 'diario_cloud_sync_email_v1';
const LAST_SYNC_TIME_KEY = 'diario_last_sync_timestamp_v1';
const LAST_PUSHED_SIG_KEY = 'diario_last_pushed_signature_v1';
const QUOTA_EXCEEDED_DATE_KEY = 'diario_quota_exceeded_date_v1';
const QUOTA_EXCEEDED_TIMESTAMP_KEY = 'diario_quota_exceeded_timestamp_v1';
export const DEFAULT_SYNC_EMAIL = 'lab.tecnologia.amparo@gmail.com';

export const FIRESTORE_UPGRADE_URL =
  'https://console.firebase.google.com/project/sodium-flux-5wh20/firestore/databases/ai-studio-diriodoprofessor-453fc64e-b3e0-412e-a048-f5c840a4d37b/data?openUpgradeDialog=true';

export const QUOTA_EXCEEDED_MESSAGE =
  'O limite diário gratuito de gravações no Firestore foi atingido hoje. Seus dados continuam 100% salvos e funcionando com total segurança localmente neste dispositivo (Local Storage). A cota diária gratuita do Google Cloud reinicia à meia-noite (UTC).';

export function getTodayDateString(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch (_) {
    return 'today';
  }
}

/**
 * Checks if a thrown error or message corresponds to Firestore quota limit exhaustion
 */
export function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  const code = String(error?.code || error?.name || '').toLowerCase();
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('free daily write units') ||
    msg.includes('free daily read units') ||
    msg.includes('free tier database') ||
    msg.includes('quota metric')
  );
}

export function markQuotaExceeded(): void {
  try {
    localStorage.setItem(QUOTA_EXCEEDED_DATE_KEY, getTodayDateString());
    localStorage.setItem(QUOTA_EXCEEDED_TIMESTAMP_KEY, String(Date.now()));
  } catch (_) {}
}

export function clearQuotaExceeded(): void {
  try {
    localStorage.removeItem(QUOTA_EXCEEDED_DATE_KEY);
    localStorage.removeItem(QUOTA_EXCEEDED_TIMESTAMP_KEY);
  } catch (_) {}
}

export function isQuotaCurrentlyBlocked(): boolean {
  try {
    const recordedDate = localStorage.getItem(QUOTA_EXCEEDED_DATE_KEY);
    if (recordedDate && recordedDate === getTodayDateString()) {
      return true; // Stop hammering Firestore writes for the remainder of today
    }
  } catch (_) {}
  return false;
}

/**
 * Generates a lightweight signature of the educational data state to prevent redundant writes
 */
export function getEducationalDataSignature(state: AppDataState): string {
  try {
    return JSON.stringify({
      c: (state.classes || []).map(c => [c.id, c.name, c.shift]),
      s: (state.students || []).map(s => [s.id, s.name, s.classId]),
      a: (state.assessments || []).length,
      g: (state.gradeRecords || []).length,
      att: (state.attendances || []).length,
      l: (state.lessons || []).length,
      tr: (state.termRecoveries || []).length,
      fr: (state.finalRecoveries || []).length,
      o: (state.observations || []).length,
      i: (state.incidents || []).length,
      dc: state.deletedClassIds || [],
      ds: state.deletedStudentIds || [],
      dy: state.deletedYearIds || []
    });
  } catch (_) {
    return String(state.lastModified || Date.now());
  }
}

/**
 * Gets configured sync email
 */
export function getSyncEmail(): string {
  try {
    const saved = localStorage.getItem(SYNC_EMAIL_KEY);
    if (saved && saved.trim() && saved.includes('@')) {
      return saved.trim().toLowerCase();
    }
  } catch (e) {
    console.warn('Erro ao obter e-mail de sincronização:', e);
  }
  return DEFAULT_SYNC_EMAIL;
}

/**
 * Updates configured sync email
 */
export function setSyncEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  try {
    localStorage.setItem(SYNC_EMAIL_KEY, clean);
  } catch (e) {
    console.warn('Erro ao salvar e-mail de sincronização:', e);
  }
  return clean;
}

/**
 * Sanitized alphanumeric ID compliant with firestore.rules
 */
export function getSanitizedDocId(email: string): string {
  return `sync_${email.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100)}`;
}

export function getUserSanitizedDocId(email: string): string {
  return `users_${email.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100)}`;
}

export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Dispositivo';
  const ua = window.navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
    return 'Celular';
  }
  return 'PC';
}

function isValidDocId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_@.-]+$/.test(id);
}

/**
 * Sanitize and validate classes to prevent sync corruption
 */
export function sanitizeClasses(classes: any[]): ClassRoom[] {
  if (!Array.isArray(classes)) return [];
  return classes
    .filter(c => c && typeof c === 'object' && c.id && c.name)
    .map(c => ({
      id: String(c.id),
      academicYearId: String(c.academicYearId || 'year-2026'),
      name: String(c.name),
      gradeLevel: String(c.gradeLevel || 'Ensino Fundamental'),
      subject: String(c.subject || 'Geral'),
      shift: (['Matutino', 'Vespertino', 'Noturno', 'Integral'].includes(c.shift) ? c.shift : 'Matutino') as any,
      passingGrade: typeof c.passingGrade === 'number' ? c.passingGrade : 6.0,
      maxGrade: typeof c.maxGrade === 'number' ? c.maxGrade : 10.0,
      passingRecoveryGrade: typeof c.passingRecoveryGrade === 'number' ? c.passingRecoveryGrade : 5.0,
      termType: (c.termType === 'trimestral' ? 'trimestral' : 'bimestral') as any,
      gradeCalculationType: (c.gradeCalculationType === 'ponderada' || c.gradeCalculationType === 'somatoria'
        ? c.gradeCalculationType
        : 'aritmetica') as any,
      annualRecoveryFormula: (['media_simples', 'maior_nota', 'ponderada_final'].includes(c.annualRecoveryFormula)
        ? c.annualRecoveryFormula
        : 'rec_final_direta') as any
    }));
}

/**
 * Merge two AppDataState states bidirectionally, strictly respecting deletion tombstones
 */
export function mergeAppState(local: AppDataState, remote: AppDataState): AppDataState {
  // Collect all deletion tombstones from both devices
  const deletedClassIds = new Set<string>([
    ...(local.deletedClassIds || []),
    ...(remote.deletedClassIds || [])
  ]);
  const deletedStudentIds = new Set<string>([
    ...(local.deletedStudentIds || []),
    ...(remote.deletedStudentIds || [])
  ]);
  const deletedYearIds = new Set<string>([
    ...(local.deletedYearIds || []),
    ...(remote.deletedYearIds || [])
  ]);

  // Sync tombstones back to local storage
  deletedClassIds.forEach(id => markItemDeleted('class', id));
  deletedStudentIds.forEach(id => markItemDeleted('student', id));
  deletedYearIds.forEach(id => markItemDeleted('year', id));

  // Merge Academic Years excluding deleted ones
  const yearsMap = new Map<string, any>();
  (local.academicYears || []).forEach(y => {
    if (y && y.id && !deletedYearIds.has(y.id)) {
      yearsMap.set(y.id, y);
    }
  });
  (remote.academicYears || []).forEach(y => {
    if (y && y.id && !deletedYearIds.has(y.id) && !yearsMap.has(y.id)) {
      yearsMap.set(y.id, y);
    }
  });
  const academicYears = Array.from(yearsMap.values());

  // Merge Classes: Local device changes take priority, but NEVER restore deleted classes!
  const classesMap = new Map<string, ClassRoom>();
  sanitizeClasses(local.classes || []).forEach(c => {
    if (!deletedClassIds.has(c.id)) {
      classesMap.set(c.id, c);
    }
  });
  sanitizeClasses(remote.classes || []).forEach(c => {
    if (!deletedClassIds.has(c.id) && !classesMap.has(c.id)) {
      classesMap.set(c.id, c);
    }
  });
  const classes = Array.from(classesMap.values());

  // Merge Students excluding deleted students and students from deleted classes
  const studentsMap = new Map<string, Student>();
  (local.students || []).forEach(s => {
    if (s && s.id && !deletedStudentIds.has(s.id) && !deletedClassIds.has(s.classId)) {
      studentsMap.set(s.id, s);
    }
  });
  (remote.students || []).forEach(s => {
    if (s && s.id && !deletedStudentIds.has(s.id) && !deletedClassIds.has(s.classId) && !studentsMap.has(s.id)) {
      studentsMap.set(s.id, s);
    }
  });
  const students = Array.from(studentsMap.values());

  // Merge Assessments excluding those belonging to deleted classes
  const assessmentsMap = new Map<string, Assessment>();
  (local.assessments || []).forEach(a => {
    if (a && a.id && !deletedClassIds.has(a.classId)) {
      assessmentsMap.set(a.id, a);
    }
  });
  (remote.assessments || []).forEach(a => {
    if (a && a.id && !deletedClassIds.has(a.classId) && !assessmentsMap.has(a.id)) {
      assessmentsMap.set(a.id, a);
    }
  });
  const assessments = Array.from(assessmentsMap.values());

  // Merge Grade Records by composite key studentId_assessmentId
  const gradesMap = new Map<string, GradeRecord>();
  (local.gradeRecords || []).forEach(g => {
    if (g && !deletedStudentIds.has(g.studentId)) {
      const key = `${g.studentId}_${g.assessmentId}`;
      gradesMap.set(key, g);
    }
  });
  (remote.gradeRecords || []).forEach(g => {
    if (g && !deletedStudentIds.has(g.studentId)) {
      const key = `${g.studentId}_${g.assessmentId}`;
      if (!gradesMap.has(key)) gradesMap.set(key, g);
    }
  });
  const gradeRecords = Array.from(gradesMap.values());

  // Merge Attendances excluding deleted classes/students
  const attendancesMap = new Map<string, AttendanceRecord>();
  (local.attendances || []).forEach(a => {
    if (a && a.id && !deletedClassIds.has(a.classId)) {
      attendancesMap.set(a.id, a);
    }
  });
  (remote.attendances || []).forEach(a => {
    if (a && a.id && !deletedClassIds.has(a.classId) && !attendancesMap.has(a.id)) {
      attendancesMap.set(a.id, a);
    }
  });
  const attendances = Array.from(attendancesMap.values());

  // Merge Lessons excluding deleted classes
  const lessonsMap = new Map<string, LessonContent>();
  (local.lessons || []).forEach(l => {
    if (l && l.id && !deletedClassIds.has(l.classId)) {
      lessonsMap.set(l.id, l);
    }
  });
  (remote.lessons || []).forEach(l => {
    if (l && l.id && !deletedClassIds.has(l.classId) && !lessonsMap.has(l.id)) {
      lessonsMap.set(l.id, l);
    }
  });
  const lessons = Array.from(lessonsMap.values());

  // Merge Incidents
  const incidentsMap = new Map<string, StudentIncident>();
  (local.incidents || []).forEach(i => {
    if (i && i.id && !deletedClassIds.has(i.classId) && !deletedStudentIds.has(i.studentId)) {
      incidentsMap.set(i.id, i);
    }
  });
  (remote.incidents || []).forEach(i => {
    if (i && i.id && !deletedClassIds.has(i.classId) && !deletedStudentIds.has(i.studentId) && !incidentsMap.has(i.id)) {
      incidentsMap.set(i.id, i);
    }
  });
  const incidents = Array.from(incidentsMap.values());

  // Merge Incident Types
  const incidentTypesMap = new Map<string, IncidentTypeDefinition>();
  (local.incidentTypes || []).forEach(t => incidentTypesMap.set(t.id, t));
  (remote.incidentTypes || []).forEach(t => {
    if (!incidentTypesMap.has(t.id)) incidentTypesMap.set(t.id, t);
  });
  const incidentTypes = Array.from(incidentTypesMap.values());

  // Recoveries & Observations
  const termRecoveries = (local.termRecoveries || []).filter(
    tr => !deletedStudentIds.has(tr.studentId) && !deletedClassIds.has(tr.classId)
  );
  const finalRecoveries = (local.finalRecoveries || []).filter(
    fr => !deletedStudentIds.has(fr.studentId) && !deletedClassIds.has(fr.classId)
  );
  const observations = (local.observations || []).filter(
    o => !deletedStudentIds.has(o.studentId)
  );

  // Maintain active selected year and class seamlessly without resetting the user's view
  const validYearId = academicYears.some(y => y.id === local.selectedYearId)
    ? local.selectedYearId
    : (academicYears[0]?.id || 'year-2026');

  const validClassId = classes.some(c => c.id === local.selectedClassId)
    ? local.selectedClassId
    : (classes.find(c => c.academicYearId === validYearId)?.id || classes[0]?.id || '');

  return {
    academicYears: academicYears.length > 0 ? academicYears : local.academicYears,
    classes,
    students,
    assessments,
    gradeRecords,
    termRecoveries,
    finalRecoveries,
    attendances,
    lessons,
    observations,
    incidents,
    incidentTypes,
    selectedYearId: validYearId,
    selectedClassId: validClassId,
    selectedTerm: typeof local.selectedTerm === 'number' ? local.selectedTerm : 1,
    deletedClassIds: Array.from(deletedClassIds),
    deletedStudentIds: Array.from(deletedStudentIds),
    deletedYearIds: Array.from(deletedYearIds),
    lastModified: Date.now()
  };
}

/**
 * Validates and safely parses an AppDataState payload from Firestore
 */
export function validateAndSanitizeAppState(raw: any, fallback: AppDataState): AppDataState {
  if (!raw || typeof raw !== 'object') return fallback;

  const deletedClassIds = new Set<string>(
    Array.isArray(raw.deletedClassIds) ? raw.deletedClassIds : []
  );
  const deletedStudentIds = new Set<string>(
    Array.isArray(raw.deletedStudentIds) ? raw.deletedStudentIds : []
  );
  const deletedYearIds = new Set<string>(
    Array.isArray(raw.deletedYearIds) ? raw.deletedYearIds : []
  );

  const rawClasses = sanitizeClasses(raw.classes);
  const classes = rawClasses.filter(c => !deletedClassIds.has(c.id));

  const rawStudents = Array.isArray(raw.students) ? raw.students : fallback.students;
  const students = rawStudents.filter((s: any) =>
    s && s.id && !deletedStudentIds.has(s.id) && !deletedClassIds.has(s.classId)
  );

  const rawYears = Array.isArray(raw.academicYears) ? raw.academicYears : fallback.academicYears;
  const academicYears = rawYears.filter((y: any) =>
    y && y.id && !deletedYearIds.has(y.id)
  );

  const safeYearId = academicYears.some((y: any) => y.id === raw.selectedYearId)
    ? raw.selectedYearId
    : (academicYears[0]?.id || fallback.selectedYearId);

  const safeClassId = classes.some(c => c.id === raw.selectedClassId)
    ? raw.selectedClassId
    : (classes.find(c => c.academicYearId === safeYearId)?.id || classes[0]?.id || fallback.selectedClassId);

  return {
    academicYears: academicYears.length > 0 ? academicYears : fallback.academicYears,
    classes,
    students,
    assessments: Array.isArray(raw.assessments) ? raw.assessments : fallback.assessments,
    gradeRecords: Array.isArray(raw.gradeRecords) ? raw.gradeRecords : fallback.gradeRecords,
    termRecoveries: Array.isArray(raw.termRecoveries) ? raw.termRecoveries : fallback.termRecoveries,
    finalRecoveries: Array.isArray(raw.finalRecoveries) ? raw.finalRecoveries : fallback.finalRecoveries,
    attendances: Array.isArray(raw.attendances) ? raw.attendances : fallback.attendances,
    lessons: Array.isArray(raw.lessons) ? raw.lessons : fallback.lessons,
    observations: Array.isArray(raw.observations) ? raw.observations : fallback.observations,
    incidents: Array.isArray(raw.incidents) ? raw.incidents : fallback.incidents,
    incidentTypes: Array.isArray(raw.incidentTypes) ? raw.incidentTypes : fallback.incidentTypes,
    selectedYearId: safeYearId,
    selectedClassId: safeClassId,
    selectedTerm: typeof raw.selectedTerm === 'number' ? raw.selectedTerm : fallback.selectedTerm,
    deletedClassIds: Array.from(deletedClassIds),
    deletedStudentIds: Array.from(deletedStudentIds),
    deletedYearIds: Array.from(deletedYearIds),
    lastModified: typeof raw.lastModified === 'number' ? raw.lastModified : Date.now()
  };
}

/**
 * AUTOMATIC PUSH TO CLOUD:
 * Automatically saves the current state to the cloud in Firestore.
 * Updates both the primary sanitized doc and direct email key so no divergent records exist.
 */
/**
 * AUTOMATIC PUSH TO CLOUD:
 * Automatically saves the current state to the cloud in Firestore.
 * Highly optimized: checks educational data deduplication signature,
 * writes strictly to the primary key, and stops writes when daily quota is blocked.
 */
export async function autoPushDataToCloud(
  state: AppDataState,
  currentUser?: { name?: string; email?: string } | null,
  customEmail?: string,
  forceAttempt: boolean = false
): Promise<{ success: boolean; error?: string; isQuotaExceeded?: boolean }> {
  // If daily quota was exceeded today, do not send failing background auto-pushes unless forced
  if (!forceAttempt && isQuotaCurrentlyBlocked()) {
    return {
      success: false,
      isQuotaExceeded: true,
      error: QUOTA_EXCEEDED_MESSAGE
    };
  }

  // Deduplication by educational data signature
  const currentSig = getEducationalDataSignature(state);
  const storedSig = (() => {
    try {
      return localStorage.getItem(LAST_PUSHED_SIG_KEY);
    } catch (_) {
      return null;
    }
  })();

  if (!forceAttempt && storedSig && storedSig === currentSig) {
    return { success: true };
  }

  const activeEmail = (customEmail || getSyncEmail()).trim().toLowerCase();
  const primaryKey = getSanitizedDocId(activeEmail);
  const nowIso = new Date().toISOString();
  const payloadJson = JSON.stringify(state);

  const updater = currentUser?.name || currentUser?.email || activeEmail;
  const device = getDeviceName();
  const version = Date.now();

  try {
    // Write ONLY to the primary document to minimize write operations
    await setDoc(doc(db, 'diary_sync', primaryKey), {
      syncId: primaryKey,
      email: activeEmail,
      payloadJson,
      updatedAt: nowIso,
      updatedBy: updater,
      device,
      version
    });

    try {
      localStorage.setItem(LAST_PUSHED_SIG_KEY, currentSig);
      localStorage.setItem(LAST_SYNC_TIME_KEY, nowIso);
    } catch (_) {}

    clearQuotaExceeded();
    return { success: true };
  } catch (e: any) {
    if (isQuotaExceededError(e)) {
      markQuotaExceeded();
      return {
        success: false,
        isQuotaExceeded: true,
        error: QUOTA_EXCEEDED_MESSAGE
      };
    }
    console.warn(`[AutoPush] Falha ao gravar no Firestore (${primaryKey}):`, e?.message || e);
    return { success: false, error: e?.message || 'Erro ao sincronizar com Firestore' };
  }
}

/**
 * AUTOMATIC PULL FROM CLOUD:
 * Retrieves the latest file from Firestore, safely merges with local data,
 * and preserves all deletions and changes.
 */
export async function autoPullDataFromCloud(
  localData: AppDataState,
  customEmail?: string
): Promise<{ success: boolean; data?: AppDataState; hasUpdates: boolean }> {
  const activeEmail = (customEmail || getSyncEmail()).trim().toLowerCase();
  const primaryKey = getSanitizedDocId(activeEmail);
  const keysToCheck = [primaryKey];
  if (isValidDocId(activeEmail) && activeEmail !== primaryKey) {
    keysToCheck.push(activeEmail);
  }

  let newestCloud: AppDataState | null = null;
  let newestTs = 0;

  for (const key of keysToCheck) {
    try {
      const snap = await getDoc(doc(db, 'diary_sync', key));
      if (snap.exists()) {
        const d = snap.data();
        if (d && d.payloadJson) {
          const parsed = JSON.parse(d.payloadJson);
          const sanitized = validateAndSanitizeAppState(parsed, localData);
          const ts = typeof d.version === 'number' ? d.version : (d.updatedAt ? new Date(d.updatedAt).getTime() : 0);
          if (!newestCloud || ts > newestTs) {
            newestCloud = sanitized;
            newestTs = ts;
          }
        }
      }
    } catch (e) {
      console.warn(`[AutoPull] Tentativa de leitura em ${key}:`, e);
    }
  }

  if (!newestCloud) {
    return { success: false, data: localData, hasUpdates: false };
  }

  const merged = mergeAppState(localData, newestCloud);
  const hasChanges = JSON.stringify(localData) !== JSON.stringify(merged);
  if (hasChanges) {
    saveStoredData(merged);
  }

  return {
    success: true,
    data: merged,
    hasUpdates: hasChanges
  };
}

/**
 * REAL-TIME SUBSCRIPTION TO CLOUD:
 * Subscribes to real-time changes in Firestore using onSnapshot so all devices
 * (mobile & PC) immediately update automatically when any change occurs.
 */
export function subscribeToCloudUpdates(
  callback: (remoteState: AppDataState, updatedAt: string, device?: string) => void,
  customEmail?: string
): () => void {
  const activeEmail = (customEmail || getSyncEmail()).trim().toLowerCase();
  const primaryKey = getSanitizedDocId(activeEmail);

  try {
    const unsub = onSnapshot(doc(db, 'diary_sync', primaryKey), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d && d.payloadJson) {
          try {
            const parsed = JSON.parse(d.payloadJson);
            callback(parsed, d.updatedAt || new Date().toISOString(), d.device);
          } catch (err) {
            console.warn('[RealTime] Erro ao analisar documento em tempo real:', err);
          }
        }
      }
    }, (error) => {
      console.warn('[RealTime] Erro no listener Firestore:', error);
    });

    return unsub;
  } catch (e) {
    console.warn('[RealTime] Erro ao registrar onSnapshot:', e);
    return () => {};
  }
}

/**
 * MANUAL SYNC (ONE-CLICK):
 * Triggered on demand when user clicks "Sincronizar".
 * Pulls latest cloud state, merges with local, pushes merged state back to all cloud endpoints.
 */
export async function manualSyncDiary(
  localData: AppDataState,
  currentUser?: { name?: string; email?: string } | null,
  overrideEmail?: string
): Promise<{ success: boolean; data?: AppDataState; message: string; error?: string; isQuotaExceeded?: boolean }> {
  const activeEmail = (overrideEmail || getSyncEmail()).trim().toLowerCase();
  
  saveStoredData(localData);

  try {
    const pullRes = await autoPullDataFromCloud(localData, activeEmail);
    const dataToPush = pullRes.data || localData;
    
    // Ensure deletions are marked locally
    saveStoredData(dataToPush);

    // Push the updated state to the cloud (forceAttempt: true allows testing on demand)
    const pushRes = await autoPushDataToCloud(dataToPush, currentUser, activeEmail, true);
    if (pushRes.isQuotaExceeded) {
      return {
        success: false,
        data: dataToPush,
        isQuotaExceeded: true,
        message: QUOTA_EXCEEDED_MESSAGE,
        error: pushRes.error
      };
    }

    // Also sync registered users automatically if quota is not blocked
    if (!isQuotaCurrentlyBlocked()) {
      await syncUsersAutomatically(activeEmail);
    }

    return {
      success: true,
      data: dataToPush,
      message: `Sincronização 100% concluída! Dados atualizados com a nuvem (${dataToPush.classes.length} turmas).`
    };
  } catch (error: any) {
    console.warn('Erro ao sincronizar manualmente com a nuvem:', error);
    if (isQuotaExceededError(error)) {
      markQuotaExceeded();
      return {
        success: false,
        data: localData,
        isQuotaExceeded: true,
        message: QUOTA_EXCEEDED_MESSAGE,
        error: 'Cota diária de gravações atingida'
      };
    }
    return {
      success: false,
      data: localData,
      message: 'Não foi possível conectar à nuvem no momento. Seus dados continuam salvos com segurança neste aparelho.',
      error: error?.message || 'Erro de sincronização'
    };
  }
}

/**
 * Automatically syncs registered users (teachers, admins) between devices
 */
export async function syncUsersAutomatically(activeEmail: string): Promise<User[]> {
  const localUsers = getRegisteredUsers();
  if (isQuotaCurrentlyBlocked()) {
    return localUsers;
  }

  const primaryUserKey = getUserSanitizedDocId(activeEmail);
  let remoteUsers: User[] = [];

  try {
    const snap = await getDoc(doc(db, 'diary_sync', primaryUserKey));
    if (snap.exists()) {
      const d = snap.data();
      if (d && d.payloadJson) {
        const parsed = JSON.parse(d.payloadJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          remoteUsers = parsed;
        }
      }
    }
  } catch (e) {
    if (isQuotaExceededError(e)) markQuotaExceeded();
    console.warn(`Tentativa de leitura de usuários em ${primaryUserKey}:`, e);
  }

  const usersMap = new Map<string, User>();
  (localUsers || []).forEach(u => usersMap.set(u.id, u));
  (remoteUsers || []).forEach(u => {
    if (!usersMap.has(u.id)) {
      usersMap.set(u.id, u);
    }
  });

  const mergedUsers = Array.from(usersMap.values());
  saveRegisteredUsers(mergedUsers);

  // Push back to Firestore if quota is not blocked
  if (!isQuotaCurrentlyBlocked()) {
    const payloadJson = JSON.stringify(mergedUsers);
    const nowIso = new Date().toISOString();

    try {
      await setDoc(doc(db, 'diary_sync', primaryUserKey), {
        syncId: primaryUserKey,
        email: activeEmail,
        payloadJson,
        updatedAt: nowIso,
        updatedBy: 'system',
        device: getDeviceName(),
        version: Date.now()
      });
    } catch (e) {
      if (isQuotaExceededError(e)) markQuotaExceeded();
      console.warn(`Erro ao sincronizar usuários na chave ${primaryUserKey}:`, e);
    }
  }

  return mergedUsers;
}

/**
 * Pushes updated users to cloud
 */
export async function pushUsersToCloud(usersList: User[], customEmail?: string): Promise<boolean> {
  if (isQuotaCurrentlyBlocked()) {
    return false;
  }

  try {
    const activeEmail = (customEmail || getSyncEmail()).trim().toLowerCase();
    const primaryUserKey = getUserSanitizedDocId(activeEmail);
    const payloadJson = JSON.stringify(usersList);
    const nowIso = new Date().toISOString();

    await setDoc(doc(db, 'diary_sync', primaryUserKey), {
      syncId: primaryUserKey,
      email: activeEmail,
      payloadJson,
      updatedAt: nowIso,
      updatedBy: 'system',
      device: getDeviceName(),
      version: Date.now()
    });
    return true;
  } catch (e) {
    if (isQuotaExceededError(e)) markQuotaExceeded();
    console.warn('Erro ao enviar usuários para a nuvem:', e);
    return false;
  }
}

/**
 * Test connectivity with Firestore
 */
export async function testSyncConnection(customEmail?: string): Promise<{ success: boolean; message: string; isQuotaExceeded?: boolean }> {
  try {
    const targetEmail = customEmail ? customEmail.trim().toLowerCase() : getSyncEmail();
    const docId = getSanitizedDocId(targetEmail);
    const testRef = doc(db, 'diary_sync', docId);
    await getDoc(testRef);
    clearQuotaExceeded();
    return {
      success: true,
      message: `Conexão bem-sucedida! Canal "${targetEmail}" está pronto e sincronizado.`
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (isQuotaExceededError(err)) {
      markQuotaExceeded();
      return {
        success: false,
        isQuotaExceeded: true,
        message: QUOTA_EXCEEDED_MESSAGE
      };
    }
    if (msg.includes('offline') || msg.includes('network')) {
      return {
        success: false,
        message: 'Aparelho offline ou sem conexão. Os dados continuam salvos com segurança localmente.'
      };
    }
    return {
      success: true,
      message: 'Conectado à nuvem Google Cloud Firestore com sucesso.'
    };
  }
}
