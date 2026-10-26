export type TermType = 'bimestral' | 'trimestral';
export type GradeCalculationType = 'aritmetica' | 'ponderada' | 'somatoria';
export type AnnualRecoveryFormula = 'rec_final_direta' | 'media_aritmetica' | 'substituicao' | 'substitui_menor_bimestre' | 'media_ponderada';

export interface AcademicYear {
  id: string;
  year: number;
  title: string;
  termType: TermType;
  isActive: boolean;
  notes?: string;
}

export interface TermPeriod {
  term: number; // 1, 2, 3, 4
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ClassRoom {
  id: string;
  academicYearId: string;
  name: string;
  gradeLevel: string; // ex: 9º Ano - Ensino Fundamental II
  subject: string; // ex: Matemática
  shift: 'Matutino' | 'Vespertino' | 'Noturno' | 'Integral';
  passingGrade: number; // ex: 6.0 ou 7.0
  passingRecoveryGrade?: number; // ex: 5.0 ou 6.0
  maxGrade: number; // ex: 10.0
  termType: TermType;
  gradeCalculationType?: GradeCalculationType; // Aritmética simples, ponderada ou somatória
  annualRecoveryFormula?: AnnualRecoveryFormula; // Média aritmética, Substituição se maior, etc.
  termPeriods?: TermPeriod[]; // Início e término de cada bimestre / trimestre
}

export type StudentStatus = 'active' | 'transferred' | 'canceled' | 'inactive';

export interface Student {
  id: string;
  classId: string;
  rollNumber: number;
  name: string;
  enrollmentNumber: string;
  guardianName?: string;
  guardianPhone?: string;
  status: StudentStatus;
  notes?: string;
}

export type AssessmentType = 'prova' | 'trabalho' | 'simulado' | 'participacao' | 'recuperacao';

export interface Assessment {
  id: string;
  classId: string;
  term: number; // 1, 2, 3, 4
  name: string;
  type: AssessmentType;
  maxScore: number;
  weight: number;
  date: string;
}

export interface GradeRecord {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number | null; // null se ausente/sem nota
}

export interface TermRecoveryRecord {
  id: string;
  classId: string;
  term: number; // 1, 2, 3, 4
  studentId: string;
  score: number | null; // Nota da recuperação paralela
}

export interface FinalRecoveryRecord {
  id: string;
  classId: string;
  studentId: string;
  score: number | null; // Nota da recuperação final anual
}

export type AttendanceStatus = 'present' | 'absent' | 'justified';

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  term: number;
  status: AttendanceStatus;
  note?: string;
}

export type LessonStatus = 'previsto' | 'dado';

export interface LessonContent {
  id: string;
  classId: string;
  date: string;
  term: number;
  lessonCount: number; // Quantidade de aulas (ex: 2 aulas geminadas)
  topic: string;
  contentDescription: string;
  bnccSkills?: string; // ex: EF09MA01, EF09MA02
  homework?: string;
  externalLink?: string; // Link para vídeo, slide, drive, etc.
  externalLinkTitle?: string;
  status?: LessonStatus; // 'previsto' ou 'dado'
}

export type IncidentColor =
  | 'rose'
  | 'amber'
  | 'orange'
  | 'blue'
  | 'purple'
  | 'emerald'
  | 'indigo'
  | 'slate'
  | 'teal'
  | 'cyan';

export interface IncidentTypeDefinition {
  id: string;
  label: string;
  color: IncidentColor;
  description?: string;
  isDefault?: boolean;
}

export type IncidentType = string;

export interface StudentIncident {
  id: string;
  classId: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  term: number;
  type: string;
  title: string;
  description: string;
  actionTaken?: string;
  notifiedGuardian?: boolean;
  createdAt: string;
}

export interface StudentObservation {
  id: string;
  studentId: string;
  term: number;
  observation: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'professor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole; // 'admin' ou 'professor'
  roleLabel?: string; // ex: Administrador do Sistema, Professor de Matemática
  schoolName?: string;
  phone?: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
  assignedClassIds?: string[]; // IDs das turmas que o professor tem permissão de acessar
}

export type BookCheckStatus = 'visto_completo' | 'incompleto' | 'nao_fez' | 'atrasado' | 'justificado';

export interface BookAssignment {
  id: string;
  classId: string;
  term: number; // 1, 2, 3, 4
  bookTitle: string; // Ex: "Livro Didático - Matemática PNLD", "Apostila Anglo"
  unitOrChapter: string; // Ex: "Capítulo 4 - Teorema de Tales"
  pages: string; // Ex: "págs. 65 a 72"
  assignedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  description?: string; // Orientações ou exercícios específicos
  maxScore?: number; // Pontos opcionais (ex: 10 ou 2.0)
  createdAt: string;
}

export interface StudentBookCheck {
  id: string;
  bookAssignmentId: string;
  studentId: string;
  classId: string;
  status: BookCheckStatus;
  score?: number | null;
  checkedAt?: string;
  notes?: string;
}
