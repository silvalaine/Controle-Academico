import { AppDataState } from './storage';
import {
  requestDriveAccessToken,
  setCachedGoogleAccessToken,
  DriveAuthError
} from '../firebase';
import { getRegisteredUsers, mergeRecoveredUsers } from './auth';

export interface DriveBackupFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  bytes?: number;
  modifiedTime: string;
  createdTime?: string;
  webViewLink?: string;
  description?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createBackupSnapshotPayload(data: AppDataState) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}`;
  const filename = `Diario_do_Professor_Backup_${dateStr}.json`;
  const registeredUsers = getRegisteredUsers();

  const payload = {
    app: 'Diário do Professor - Gestão Escolar',
    version: '2.0',
    exportedAt: now.toISOString(),
    totalClasses: data.classes?.length || 0,
    totalStudents: data.students?.length || 0,
    totalUsers: registeredUsers.length,
    users: registeredUsers,
    academicYears: data.academicYears || [],
    classes: data.classes || [],
    students: data.students || [],
    assessments: data.assessments || [],
    gradeRecords: data.gradeRecords || [],
    termRecoveries: data.termRecoveries || [],
    finalRecoveries: data.finalRecoveries || [],
    attendances: data.attendances || [],
    lessons: data.lessons || [],
    observations: data.observations || [],
    incidents: data.incidents || [],
    incidentTypes: data.incidentTypes || [],
    bookAssignments: data.bookAssignments || [],
    studentBookChecks: data.studentBookChecks || [],
    totalBooks: data.bookAssignments?.length || 0,
    totalBookChecks: data.studentBookChecks?.length || 0,
    selectedYearId: data.selectedYearId,
    selectedClassId: data.selectedClassId,
    selectedTerm: data.selectedTerm,
    lastModified: Date.now()
  };

  return { now, filename, registeredUsers, payload };
}

/**
 * Downloads a complete snapshot directly to the user's device as a .json file
 */
export function exportBackupJsonFile(data: AppDataState): string {
  const { filename, payload } = createBackupSnapshotPayload(data);
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

async function handleDriveHttpError(response: Response, fallbackPrefix: string): Promise<never> {
  if (response.status === 401) {
    setCachedGoogleAccessToken(null);
    throw new DriveAuthError(
      'expired',
      'A sessão com o Google Drive expirou ou foi revogada. Clique em "Entrar com o Google" para reconectar.'
    );
  }
  const errorText = await response.text().catch(() => '');
  let parsedMessage = '';
  try {
    const jsonErr = JSON.parse(errorText);
    parsedMessage = jsonErr?.error?.message || '';
  } catch (_) {}

  console.error('Drive API error:', response.status, errorText);
  throw new Error(`${fallbackPrefix} (${response.status}): ${parsedMessage || 'Verifique sua conexão e tente novamente.'}`);
}

/**
 * Uploads a complete snapshot of the AppDataState directly to Google Drive
 */
export async function uploadBackupToGoogleDrive(
  data: AppDataState,
  _preferredEmail?: string
): Promise<DriveBackupFile> {
  const token = await requestDriveAccessToken();
  const { now, filename, registeredUsers, payload } = createBackupSnapshotPayload(data);

  const fileContent = JSON.stringify(payload, null, 2);
  const metadata = {
    name: filename,
    mimeType: 'application/json',
    description: `Backup do Diário do Professor gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}. Contém ${data.classes?.length || 0} turmas, ${data.students?.length || 0} alunos, ${data.bookAssignments?.length || 0} atividades de livros e ${registeredUsers.length} usuários/professores.`
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    fileContent +
    closeDelim;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!response.ok) {
    await handleDriveHttpError(response, 'Falha no upload para o Google Drive');
  }

  const result = await response.json();
  const bytes = new Blob([fileContent]).size;

  return {
    id: result.id,
    name: result.name || filename,
    mimeType: result.mimeType || 'application/json',
    size: formatBytes(bytes),
    bytes,
    modifiedTime: now.toISOString(),
    webViewLink: result.webViewLink
  };
}

/**
 * Lists backup files found in the user's Google Drive
 */
export async function listGoogleDriveBackups(_preferredEmail?: string): Promise<DriveBackupFile[]> {
  const token = await requestDriveAccessToken();

  // Search query: non-trashed files that contain 'Diario' or 'diario' or 'Backup' in name, or json files
  const query = "trashed = false and (name contains 'Diario' or name contains 'diario' or name contains 'Backup' or mimeType = 'application/json')";
  const fields = 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, description)';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=50&fields=${encodeURIComponent(fields)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    await handleDriveHttpError(response, 'Falha ao buscar backups no Google Drive');
  }

  const data = await response.json();
  const rawFiles: any[] = data.files || [];

  return rawFiles.map(file => {
    const bytes = file.size ? parseInt(file.size, 10) : undefined;
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: formatBytes(bytes),
      bytes,
      modifiedTime: file.modifiedTime,
      createdTime: file.createdTime,
      webViewLink: file.webViewLink,
      description: file.description
    };
  });
}

/**
 * Downloads and parses a backup file from Google Drive
 */
export async function downloadBackupFromGoogleDrive(
  fileId: string,
  _preferredEmail?: string
): Promise<{ data: AppDataState; metadata: { name?: string; exportedAt?: string; restoredUsersCount?: number } }> {
  const token = await requestDriveAccessToken();

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    await handleDriveHttpError(response, 'Falha ao baixar o arquivo do Google Drive');
  }

  const jsonText = await response.text();
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error('O arquivo selecionado no Google Drive não possui formato JSON válido.');
  }

  if (!parsed.academicYears || !parsed.classes || !parsed.students) {
    throw new Error('O arquivo selecionado não contém os dados esperados do Diário do Professor (anos letivos, turmas ou alunos ausentes).');
  }

  const appData: AppDataState = {
    academicYears: Array.isArray(parsed.academicYears) ? parsed.academicYears : [],
    classes: Array.isArray(parsed.classes) ? parsed.classes : [],
    students: Array.isArray(parsed.students) ? parsed.students : [],
    assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
    gradeRecords: Array.isArray(parsed.gradeRecords) ? parsed.gradeRecords : [],
    termRecoveries: Array.isArray(parsed.termRecoveries) ? parsed.termRecoveries : [],
    finalRecoveries: Array.isArray(parsed.finalRecoveries) ? parsed.finalRecoveries : [],
    attendances: Array.isArray(parsed.attendances) ? parsed.attendances : [],
    lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
    observations: Array.isArray(parsed.observations) ? parsed.observations : [],
    incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
    incidentTypes: Array.isArray(parsed.incidentTypes) ? parsed.incidentTypes : [],
    bookAssignments: Array.isArray(parsed.bookAssignments) ? parsed.bookAssignments : [],
    studentBookChecks: Array.isArray(parsed.studentBookChecks) ? parsed.studentBookChecks : [],
    selectedYearId: parsed.selectedYearId || parsed.academicYears?.[0]?.id || '',
    selectedClassId: parsed.selectedClassId || parsed.classes?.[0]?.id || '',
    selectedTerm: typeof parsed.selectedTerm === 'number' ? parsed.selectedTerm : 1,
    lastModified: Date.now()
  };

  // If backup includes registered users, restore/merge them automatically
  if (Array.isArray(parsed.users) && parsed.users.length > 0) {
    try {
      mergeRecoveredUsers(parsed.users);
    } catch (err) {
      console.warn('Erro ao restaurar usuários do backup do Drive:', err);
    }
  }

  return {
    data: appData,
    metadata: {
      name: parsed.app || 'Backup Diário do Professor',
      exportedAt: parsed.exportedAt,
      restoredUsersCount: Array.isArray(parsed.users) ? parsed.users.length : 0
    }
  };
}

/**
 * Deletes a backup file from Google Drive (requires user confirmation before calling)
 */
export async function deleteBackupFromGoogleDrive(
  fileId: string,
  _preferredEmail?: string
): Promise<void> {
  const token = await requestDriveAccessToken();

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 404) {
    await handleDriveHttpError(response, 'Falha ao excluir arquivo do Google Drive');
  }
}
