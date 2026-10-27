import {
  AcademicYear,
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
  IncidentTypeDefinition,
  BookAssignment,
  StudentBookCheck
} from '../types';
import {
  initialAcademicYears,
  initialClasses,
  initialStudents,
  initialAssessments,
  initialGradeRecords,
  initialAttendances,
  initialLessons,
  initialObservations,
  initialTermRecoveries,
  initialFinalRecoveries,
  initialIncidents,
  initialIncidentTypes,
  initialBookAssignments,
  initialStudentBookChecks
} from './initialData';

export interface AppDataState {
  academicYears: AcademicYear[];
  classes: ClassRoom[];
  students: Student[];
  assessments: Assessment[];
  gradeRecords: GradeRecord[];
  termRecoveries: TermRecoveryRecord[];
  finalRecoveries: FinalRecoveryRecord[];
  attendances: AttendanceRecord[];
  lessons: LessonContent[];
  observations: StudentObservation[];
  incidents: StudentIncident[];
  incidentTypes: IncidentTypeDefinition[];
  bookAssignments?: BookAssignment[];
  studentBookChecks?: StudentBookCheck[];
  selectedYearId: string;
  selectedClassId: string;
  selectedTerm: number;
  deletedClassIds?: string[];
  deletedStudentIds?: string[];
  deletedYearIds?: string[];
  lastModified?: number;
}

const STORAGE_KEY = 'diario_professor_data_v1';
const DELETED_CLASSES_KEY = 'diario_deleted_class_ids_v1';
const DELETED_STUDENTS_KEY = 'diario_deleted_student_ids_v1';
const DELETED_YEARS_KEY = 'diario_deleted_year_ids_v1';

export function getDeletedIds(type: 'class' | 'student' | 'year'): Set<string> {
  try {
    const key = type === 'class' ? DELETED_CLASSES_KEY : type === 'student' ? DELETED_STUDENTS_KEY : DELETED_YEARS_KEY;
    const raw = localStorage.getItem(key);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return new Set<string>();
  }
}

export function markItemDeleted(type: 'class' | 'student' | 'year', id: string): void {
  try {
    const key = type === 'class' ? DELETED_CLASSES_KEY : type === 'student' ? DELETED_STUDENTS_KEY : DELETED_YEARS_KEY;
    const current = getDeletedIds(type);
    current.add(id);
    localStorage.setItem(key, JSON.stringify(Array.from(current)));
  } catch (_) {}
}

export function clearDeletedId(type: 'class' | 'student' | 'year', id: string): void {
  try {
    const key = type === 'class' ? DELETED_CLASSES_KEY : type === 'student' ? DELETED_STUDENTS_KEY : DELETED_YEARS_KEY;
    const current = getDeletedIds(type);
    current.delete(id);
    localStorage.setItem(key, JSON.stringify(Array.from(current)));
  } catch (_) {}
}

export function restoreAllDeletedItems(): { classesRestored: number; studentsRestored: number; yearsRestored: number } {
  const classes = getDeletedIds('class');
  const students = getDeletedIds('student');
  const years = getDeletedIds('year');
  try {
    localStorage.removeItem(DELETED_CLASSES_KEY);
    localStorage.removeItem(DELETED_STUDENTS_KEY);
    localStorage.removeItem(DELETED_YEARS_KEY);
  } catch (_) {}
  return {
    classesRestored: classes.size,
    studentsRestored: students.size,
    yearsRestored: years.size
  };
}

export function loadStoredData(): AppDataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.academicYears && parsed.classes && parsed.students) {
        // Collect deleted tombstones
        const storageDeletedClasses = getDeletedIds('class');
        const stateDeletedClasses = new Set<string>(Array.isArray(parsed.deletedClassIds) ? parsed.deletedClassIds : []);
        const allDeletedClasses = new Set<string>([...storageDeletedClasses, ...stateDeletedClasses]);

        const storageDeletedStudents = getDeletedIds('student');
        const stateDeletedStudents = new Set<string>(Array.isArray(parsed.deletedStudentIds) ? parsed.deletedStudentIds : []);
        const allDeletedStudents = new Set<string>([...storageDeletedStudents, ...stateDeletedStudents]);

        const storageDeletedYears = getDeletedIds('year');
        const stateDeletedYears = new Set<string>(Array.isArray(parsed.deletedYearIds) ? parsed.deletedYearIds : []);
        const allDeletedYears = new Set<string>([...storageDeletedYears, ...stateDeletedYears]);

        // Filter classes excluding any deleted classes
        const classes = (parsed.classes || [])
          .filter((c: any) => c && c.id && !allDeletedClasses.has(c.id))
          .map((c: any) => ({
            ...c,
            annualRecoveryFormula: c.annualRecoveryFormula || 'rec_final_direta'
          }));

        // Filter students excluding any deleted students or students of deleted classes
        const students = (parsed.students || []).filter((s: any) =>
          s && s.id && !allDeletedStudents.has(s.id) && !allDeletedClasses.has(s.classId)
        );

        // Filter academic years
        const academicYears = (parsed.academicYears || []).filter((y: any) =>
          y && y.id && !allDeletedYears.has(y.id)
        );

        const safeYearId = academicYears.some((y: any) => y.id === parsed.selectedYearId)
          ? parsed.selectedYearId
          : (academicYears[0]?.id || 'year-2026');

        const safeClassId = classes.some((c: any) => c.id === parsed.selectedClassId)
          ? parsed.selectedClassId
          : (classes.find((c: any) => c.academicYearId === safeYearId)?.id || classes[0]?.id || '');

        return {
          ...parsed,
          academicYears: academicYears.length > 0 ? academicYears : initialAcademicYears,
          classes,
          students,
          selectedYearId: safeYearId,
          selectedClassId: safeClassId,
          deletedClassIds: Array.from(allDeletedClasses),
          deletedStudentIds: Array.from(allDeletedStudents),
          deletedYearIds: Array.from(allDeletedYears),
          lastModified: typeof parsed.lastModified === 'number' ? parsed.lastModified : Date.now(),
          termRecoveries: parsed.termRecoveries || initialTermRecoveries,
          finalRecoveries: parsed.finalRecoveries || initialFinalRecoveries,
          incidents: parsed.incidents || initialIncidents,
          incidentTypes: parsed.incidentTypes || initialIncidentTypes,
          bookAssignments: parsed.bookAssignments || initialBookAssignments,
          studentBookChecks: parsed.studentBookChecks || initialStudentBookChecks
        };
      }
    }
  } catch (e) {
    console.error('Falha ao ler dados do localStorage:', e);
  }

  // Fallback initial
  const defaultYear = initialAcademicYears.find(y => y.isActive) || initialAcademicYears[0];
  const defaultClass = initialClasses.find(c => c.academicYearId === defaultYear.id) || initialClasses[0];

  return {
    academicYears: initialAcademicYears,
    classes: initialClasses,
    students: initialStudents,
    assessments: initialAssessments,
    gradeRecords: initialGradeRecords,
    termRecoveries: initialTermRecoveries,
    finalRecoveries: initialFinalRecoveries,
    attendances: initialAttendances,
    lessons: initialLessons,
    observations: initialObservations,
    incidents: initialIncidents,
    incidentTypes: initialIncidentTypes,
    bookAssignments: initialBookAssignments,
    studentBookChecks: initialStudentBookChecks,
    selectedYearId: defaultYear.id,
    selectedClassId: defaultClass.id,
    selectedTerm: 1,
    deletedClassIds: [],
    deletedStudentIds: [],
    deletedYearIds: [],
    lastModified: Date.now()
  };
}

export function saveStoredData(data: AppDataState): void {
  try {
    const updatedData: AppDataState = {
      ...data,
      lastModified: data.lastModified || Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    localStorage.setItem('diario_local_last_modified', String(Date.now()));
  } catch (e) {
    console.error('Falha ao salvar dados no localStorage:', e);
  }
}

export function resetToSampleData(): AppDataState {
  const defaultYear = initialAcademicYears.find(y => y.isActive) || initialAcademicYears[0];
  const defaultClass = initialClasses.find(c => c.academicYearId === defaultYear.id) || initialClasses[0];

  try {
    localStorage.removeItem(DELETED_CLASSES_KEY);
    localStorage.removeItem(DELETED_STUDENTS_KEY);
    localStorage.removeItem(DELETED_YEARS_KEY);
  } catch (_) {}

  const state: AppDataState = {
    academicYears: initialAcademicYears,
    classes: initialClasses,
    students: initialStudents,
    assessments: initialAssessments,
    gradeRecords: initialGradeRecords,
    termRecoveries: initialTermRecoveries,
    finalRecoveries: initialFinalRecoveries,
    attendances: initialAttendances,
    lessons: initialLessons,
    observations: initialObservations,
    incidents: initialIncidents,
    incidentTypes: initialIncidentTypes,
    bookAssignments: initialBookAssignments,
    studentBookChecks: initialStudentBookChecks,
    selectedYearId: defaultYear.id,
    selectedClassId: defaultClass.id,
    selectedTerm: 1,
    deletedClassIds: [],
    deletedStudentIds: [],
    deletedYearIds: [],
    lastModified: Date.now()
  };
  saveStoredData(state);
  return state;
}
