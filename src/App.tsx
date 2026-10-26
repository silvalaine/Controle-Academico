import React, { useState, useEffect, useRef } from 'react';
import {
  loadStoredData,
  saveStoredData,
  resetToSampleData,
  AppDataState,
  markItemDeleted,
  clearDeletedId
} from './utils/storage';
import { Header, SyncStatusInfo } from './components/Header';
import { Navigation, TabId } from './components/Navigation';
import { OverviewDashboard } from './components/OverviewDashboard';
import { GradeMap } from './components/GradeMap';
import { AttendanceSystem } from './components/AttendanceSystem';
import { LessonDiary } from './components/LessonDiary';
import { StudentListGenerator } from './components/StudentListGenerator';
import { StudentIncidents } from './components/StudentIncidents';
import { StudentReport } from './components/StudentReport';
import { ManagementModal } from './components/ManagementModal';
import { AuthScreen } from './components/AuthScreen';
import { SyncEmailModal } from './components/SyncEmailModal';
import { EditClassModal } from './components/EditClassModal';
import { GoogleDriveBackupModal } from './components/GoogleDriveBackupModal';
import { UserRecoveryModal } from './components/UserRecoveryModal';
import { BookCorrectionTracker } from './components/BookCorrectionTracker';
import { Layers, CheckCircle2, AlertCircle, ExternalLink, ShieldAlert, HardDrive } from 'lucide-react';
import { getCurrentUser, logoutUser } from './utils/auth';
import {
  getSyncEmail,
  setSyncEmail,
  manualSyncDiary,
  autoPushDataToCloud,
  autoPullDataFromCloud,
  subscribeToCloudUpdates,
  mergeAppState,
  isQuotaCurrentlyBlocked,
  FIRESTORE_UPGRADE_URL,
  QUOTA_EXCEEDED_MESSAGE,
  clearQuotaExceeded
} from './utils/cloudSync';
import {
  AcademicYear,
  ClassRoom,
  Student,
  Assessment,
  GradeRecord,
  AttendanceRecord,
  LessonContent,
  StudentIncident,
  IncidentTypeDefinition,
  BookAssignment,
  StudentBookCheck,
  User
} from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [data, setData] = useState<AppDataState>(() => loadStoredData());
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [syncEmail, setSyncEmailState] = useState<string>(() => getSyncEmail());
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>(() => ({
    synced: true,
    syncing: false,
    lastDevice: typeof window !== 'undefined' && /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'Celular' : 'PC',
    isQuotaExceeded: isQuotaCurrentlyBlocked()
  }));
  const [syncToast, setSyncToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isQuotaAlertDismissed, setIsQuotaAlertDismissed] = useState(false);
  const [editingClassModal, setEditingClassModal] = useState<ClassRoom | null>(null);

  const isInitialMount = useRef(true);
  const isSyncingFromCloudRef = useRef(false);

  // 1. AUTOMATIC INITIAL CLOUD PULL & REAL-TIME LISTENER
  useEffect(() => {
    let isMounted = true;

    // Pull latest file from cloud automatically on mount
    autoPullDataFromCloud(data, syncEmail)
      .then(res => {
        if (isMounted && res.success && res.data && res.hasUpdates) {
          isSyncingFromCloudRef.current = true;
          setData(res.data);
          setSyncStatus(prev => ({
            ...prev,
            synced: true,
            syncing: false,
            lastDevice: typeof window !== 'undefined' && /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'Celular' : 'PC',
            lastUpdated: new Date().toISOString()
          }));
          setTimeout(() => {
            isSyncingFromCloudRef.current = false;
          }, 500);
        }
      })
      .catch(e => console.warn('Falha no auto-pull da nuvem:', e));

    // Subscribe to real-time changes in Firestore
    const unsub = subscribeToCloudUpdates((remoteState, updatedAt, device) => {
      if (!isMounted) return;
      setData(prev => {
        const merged = mergeAppState(prev, remoteState);
        if (JSON.stringify(prev) !== JSON.stringify(merged)) {
          isSyncingFromCloudRef.current = true;
          setSyncStatus({
            synced: true,
            syncing: false,
            lastDevice: device || 'Outro dispositivo',
            lastUpdated: updatedAt
          });
          setTimeout(() => {
            isSyncingFromCloudRef.current = false;
          }, 500);
          return merged;
        }
        return prev;
      });
    }, syncEmail);

    return () => {
      isMounted = false;
      unsub();
    };
  }, [syncEmail]);

  // 2. AUTOMATIC CLOUD PUSH: Save locally and automatically update the file in the cloud!
  useEffect(() => {
    saveStoredData(data);

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isSyncingFromCloudRef.current) {
      return;
    }

    // If quota is blocked for today, do not queue background Firestore writes
    if (isQuotaCurrentlyBlocked()) {
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        isQuotaExceeded: true
      }));
      return;
    }

    const timer = setTimeout(async () => {
      if (isQuotaCurrentlyBlocked()) {
        setSyncStatus(prev => ({ ...prev, syncing: false, isQuotaExceeded: true }));
        return;
      }
      setSyncStatus(prev => ({ ...prev, syncing: true }));
      const res = await autoPushDataToCloud(data, currentUser, syncEmail);
      setSyncStatus({
        synced: res.success,
        syncing: false,
        lastDevice: typeof window !== 'undefined' && /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'Celular' : 'PC',
        lastUpdated: new Date().toISOString(),
        error: res.error || null,
        isQuotaExceeded: !!res.isQuotaExceeded
      });
    }, 8000);

    return () => clearTimeout(timer);
  }, [data, syncEmail, currentUser]);

  // ON-DEMAND MANUAL SYNC: Executed when user clicks on "Sincronizar"
  const handleManualSync = async (customEmail?: string) => {
    const emailToUse = (customEmail || syncEmail).trim().toLowerCase();
    setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));
    try {
      const res = await manualSyncDiary(data, currentUser, emailToUse);
      if (res.data) {
        isSyncingFromCloudRef.current = true;
        setData(res.data);
        setTimeout(() => {
          isSyncingFromCloudRef.current = false;
        }, 500);
      }
      setSyncStatus({
        synced: res.success,
        syncing: false,
        lastDevice: typeof window !== 'undefined' && /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'Celular' : 'PC',
        lastUpdated: new Date().toISOString(),
        error: res.error || null,
        isQuotaExceeded: !!res.isQuotaExceeded
      });
      setSyncToast({
        type: res.success ? 'success' : res.isQuotaExceeded ? 'info' : 'error',
        message: res.message
      });
      setTimeout(() => setSyncToast(null), 6000);
      return res;
    } catch (err: any) {
      const msg = err?.message || 'Falha ao sincronizar';
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: msg
      }));
      setSyncToast({
        type: 'error',
        message: 'Não foi possível sincronizar com a nuvem no momento.'
      });
      setTimeout(() => setSyncToast(null), 5000);
      return { success: false, message: msg, error: msg };
    }
  };

  // Filter classes if user is professor and has specific assigned classes
  // If none of assigned class IDs match, fallback safely to all classes
  const accessibleClasses = React.useMemo(() => {
    if (currentUser?.role === 'professor' && currentUser.assignedClassIds && currentUser.assignedClassIds.length > 0) {
      const filtered = data.classes.filter(c => currentUser.assignedClassIds!.includes(c.id));
      return filtered.length > 0 ? filtered : data.classes;
    }
    return data.classes;
  }, [currentUser, data.classes]);

  // Current selected year and classes
  const currentYear = data.academicYears.find(y => y.id === data.selectedYearId) || data.academicYears[0];
  const yearMatches = accessibleClasses.filter(c => !data.selectedYearId || !c.academicYearId || c.academicYearId === (currentYear?.id || ''));
  const yearClasses = yearMatches.length > 0 ? yearMatches : accessibleClasses;
  const currentClass = accessibleClasses.find(c => c.id === data.selectedClassId) || yearClasses[0] || accessibleClasses[0] || null;

  // If selected student is not in current class, update it
  useEffect(() => {
    if (currentClass) {
      const classStudents = data.students.filter(s => s.classId === currentClass.id && s.status === 'active');
      if (classStudents.length > 0) {
        if (!classStudents.some(s => s.id === selectedStudentId)) {
          setSelectedStudentId(classStudents[0].id);
        }
      }
    }
  }, [currentClass?.id, data.students, selectedStudentId]);

  // Handler: Select Year
  const handleSelectYear = (yearId: string) => {
    const classesInYear = accessibleClasses.filter(c => c.academicYearId === yearId);
    const newClassId = classesInYear.length > 0 ? classesInYear[0].id : (accessibleClasses[0]?.id || data.selectedClassId);
    setData(prev => ({
      ...prev,
      selectedYearId: yearId,
      selectedClassId: newClassId
    }));
  };

  // Handler: Select Class
  const handleSelectClass = (classId: string) => {
    setData(prev => ({
      ...prev,
      selectedClassId: classId
    }));
  };

  // Handler: Select Term
  const handleSelectTerm = (term: number) => {
    setData(prev => ({
      ...prev,
      selectedTerm: term
    }));
  };

  // Handler: Reset to sample
  const handleResetData = () => {
    const reset = resetToSampleData();
    setData(reset);
    setActiveTab('overview');
  };

  // Handler: Export JSON
  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `backup_diario_professor_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Handler: Import JSON
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.academicYears && json.classes && json.students) {
          setData(json);
          alert('Dados importados com sucesso!');
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch (err) {
        alert('Erro ao processar arquivo JSON: ' + String(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handler: Print
  const handlePrint = () => {
    window.print();
  };

  // --- Grade Map Handlers ---
  const handleUpdateGrade = (assessmentId: string, studentId: string, score: number | null) => {
    setData(prev => {
      const existingIdx = prev.gradeRecords.findIndex(
        gr => gr.assessmentId === assessmentId && gr.studentId === studentId
      );

      const records = [...prev.gradeRecords];
      if (existingIdx >= 0) {
        if (score === null) {
          records.splice(existingIdx, 1);
        } else {
          records[existingIdx] = {
            ...records[existingIdx],
            score
          };
        }
      } else if (score !== null) {
        records.push({
          id: `gr-${Date.now()}-${studentId}`,
          assessmentId,
          studentId,
          score
        });
      }

      return {
        ...prev,
        gradeRecords: records
      };
    });
  };

  const handleUpdateTermRecovery = (term: number, studentId: string, score: number | null) => {
    if (!currentClass) return;
    setData(prev => {
      const records = [...(prev.termRecoveries || [])];
      const existingIdx = records.findIndex(
        r => r.classId === currentClass.id && Number(r.term) === Number(term) && r.studentId === studentId
      );

      if (existingIdx >= 0) {
        if (score === null) {
          records.splice(existingIdx, 1);
        } else {
          records[existingIdx] = {
            ...records[existingIdx],
            score
          };
        }
      } else if (score !== null) {
        records.push({
          id: `rec-t-${Date.now()}-${studentId}`,
          classId: currentClass.id,
          term: Number(term),
          studentId,
          score
        });
      }

      return {
        ...prev,
        termRecoveries: records
      };
    });
  };

  const handleUpdateFinalRecovery = (studentId: string, score: number | null) => {
    if (!currentClass) return;
    setData(prev => {
      const records = [...(prev.finalRecoveries || [])];
      const existingIdx = records.findIndex(
        r => r.classId === currentClass.id && r.studentId === studentId
      );

      if (existingIdx >= 0) {
        if (score === null) {
          records.splice(existingIdx, 1);
        } else {
          records[existingIdx] = {
            ...records[existingIdx],
            score
          };
        }
      } else if (score !== null) {
        records.push({
          id: `rec-f-${Date.now()}-${studentId}`,
          classId: currentClass.id,
          studentId,
          score
        });
      }

      return {
        ...prev,
        finalRecoveries: records
      };
    });
  };

  const handleAddAssessment = (newAsm: Omit<Assessment, 'id'>) => {
    const id = `asm-${Date.now()}`;
    setData(prev => ({
      ...prev,
      assessments: [...prev.assessments, { ...newAsm, id }]
    }));
  };

  const handleDeleteAssessment = (assessmentId: string) => {
    setData(prev => ({
      ...prev,
      assessments: prev.assessments.filter(a => a.id !== assessmentId),
      gradeRecords: prev.gradeRecords.filter(gr => gr.assessmentId !== assessmentId)
    }));
  };

  // --- Attendance Handlers ---
  const handleSaveAttendance = (records: AttendanceRecord[]) => {
    setData(prev => ({
      ...prev,
      attendances: records
    }));
  };

  const handleDeleteAttendanceDate = (date: string) => {
    if (!currentClass) return;
    setData(prev => ({
      ...prev,
      attendances: prev.attendances.filter(a => !(a.classId === currentClass.id && a.date === date))
    }));
  };

  // --- Lesson Diary Handlers ---
  const handleAddLesson = (newLesson: Omit<LessonContent, 'id'>) => {
    const id = `les-${Date.now()}`;
    setData(prev => ({
      ...prev,
      lessons: [...prev.lessons, { ...newLesson, id }]
    }));
  };

  const handleUpdateLesson = (updatedLesson: LessonContent) => {
    setData(prev => ({
      ...prev,
      lessons: prev.lessons.map(l => (l.id === updatedLesson.id ? updatedLesson : l))
    }));
  };

  const handleDeleteLesson = (lessonId: string) => {
    setData(prev => ({
      ...prev,
      lessons: prev.lessons.filter(l => l.id !== lessonId)
    }));
  };

  // --- Student Observation Handlers ---
  const handleSaveObservation = (studentId: string, term: number, text: string) => {
    setData(prev => {
      const existingIdx = prev.observations.findIndex(
        o => o.studentId === studentId && o.term === term
      );
      const updated = [...prev.observations];
      if (existingIdx >= 0) {
        updated[existingIdx] = {
          ...updated[existingIdx],
          observation: text,
          updatedAt: new Date().toISOString()
        };
      } else {
        updated.push({
          id: `obs-${Date.now()}`,
          studentId,
          term,
          observation: text,
          updatedAt: new Date().toISOString()
        });
      }
      return {
        ...prev,
        observations: updated
      };
    });
  };

  // --- Student Incidents Handlers ---
  const handleAddIncident = (newIncident: Omit<StudentIncident, 'id' | 'createdAt'>) => {
    const id = `inc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setData(prev => ({
      ...prev,
      incidents: [
        ...(prev.incidents || []),
        {
          ...newIncident,
          id,
          createdAt: new Date().toISOString()
        }
      ]
    }));
  };

  const handleUpdateIncident = (updatedIncident: StudentIncident) => {
    setData(prev => ({
      ...prev,
      incidents: (prev.incidents || []).map(inc => (inc.id === updatedIncident.id ? updatedIncident : inc))
    }));
  };

  const handleDeleteIncident = (incidentId: string) => {
    setData(prev => ({
      ...prev,
      incidents: (prev.incidents || []).filter(inc => inc.id !== incidentId)
    }));
  };

  const handleAddIncidentType = (newType: Omit<IncidentTypeDefinition, 'id'>) => {
    const id = `type-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setData(prev => ({
      ...prev,
      incidentTypes: [...(prev.incidentTypes || []), { ...newType, id }]
    }));
  };

  const handleDeleteIncidentType = (typeId: string) => {
    setData(prev => ({
      ...prev,
      incidentTypes: (prev.incidentTypes || []).filter(t => t.id !== typeId)
    }));
  };

  // --- Book Correction Handlers ---
  const handleAddBookAssignment = (newAssignment: Omit<BookAssignment, 'id' | 'createdAt'>) => {
    const id = `bk-${Date.now()}`;
    const item: BookAssignment = {
      ...newAssignment,
      id,
      createdAt: new Date().toISOString()
    };
    setData(prev => ({
      ...prev,
      bookAssignments: [...(prev.bookAssignments || []), item]
    }));
  };

  const handleUpdateBookAssignment = (updatedAssignment: BookAssignment) => {
    setData(prev => ({
      ...prev,
      bookAssignments: (prev.bookAssignments || []).map(b => (b.id === updatedAssignment.id ? updatedAssignment : b))
    }));
  };

  const handleDeleteBookAssignment = (assignmentId: string) => {
    setData(prev => ({
      ...prev,
      bookAssignments: (prev.bookAssignments || []).filter(b => b.id !== assignmentId),
      studentBookChecks: (prev.studentBookChecks || []).filter(c => c.bookAssignmentId !== assignmentId)
    }));
  };

  const handleUpdateStudentBookCheck = (updatedCheck: StudentBookCheck) => {
    setData(prev => {
      const existing = (prev.studentBookChecks || []).findIndex(
        c => c.id === updatedCheck.id || (c.studentId === updatedCheck.studentId && c.bookAssignmentId === updatedCheck.bookAssignmentId)
      );
      let nextList = [...(prev.studentBookChecks || [])];
      if (existing >= 0) {
        nextList[existing] = updatedCheck;
      } else {
        nextList.push(updatedCheck);
      }
      return {
        ...prev,
        studentBookChecks: nextList
      };
    });
  };

  const handleBatchUpdateStudentBookChecks = (checks: StudentBookCheck[]) => {
    setData(prev => {
      const current = [...(prev.studentBookChecks || [])];
      checks.forEach(newChk => {
        const idx = current.findIndex(
          c => c.id === newChk.id || (c.studentId === newChk.studentId && c.bookAssignmentId === newChk.bookAssignmentId)
        );
        if (idx >= 0) {
          current[idx] = newChk;
        } else {
          current.push(newChk);
        }
      });
      return {
        ...prev,
        studentBookChecks: current
      };
    });
  };

  // --- Management Handlers (Years, Classes, Students) ---
  const handleAddYear = (newYear: Omit<AcademicYear, 'id'>) => {
    const id = `year-${Date.now()}`;
    clearDeletedId('year', id);
    setData(prev => ({
      ...prev,
      academicYears: [...prev.academicYears, { ...newYear, id }],
      selectedYearId: id,
      deletedYearIds: (prev.deletedYearIds || []).filter(yId => yId !== id),
      lastModified: Date.now()
    }));
  };

  const handleUpdateYear = (year: AcademicYear) => {
    setData(prev => ({
      ...prev,
      academicYears: prev.academicYears.map(y => (y.id === year.id ? year : y)),
      lastModified: Date.now()
    }));
  };

  const handleDeleteYear = (yearId: string) => {
    markItemDeleted('year', yearId);
    setData(prev => {
      const remainingYears = prev.academicYears.filter(y => y.id !== yearId);
      const nextYear = remainingYears[0];
      const removedClasses = prev.classes.filter(c => c.academicYearId === yearId);
      removedClasses.forEach(c => markItemDeleted('class', c.id));
      const deletedClassIds = Array.from(new Set([
        ...(prev.deletedClassIds || []),
        ...removedClasses.map(c => c.id)
      ]));

      const nextState: AppDataState = {
        ...prev,
        academicYears: remainingYears,
        selectedYearId: nextYear?.id || '',
        classes: prev.classes.filter(c => c.academicYearId !== yearId),
        deletedClassIds,
        deletedYearIds: Array.from(new Set([...(prev.deletedYearIds || []), yearId])),
        lastModified: Date.now()
      };
      saveStoredData(nextState);
      return nextState;
    });
  };

  const handleAddClass = (newClass: Omit<ClassRoom, 'id'>) => {
    const id = `class-${Date.now()}`;
    clearDeletedId('class', id);
    setData(prev => {
      const nextState: AppDataState = {
        ...prev,
        classes: [...prev.classes, { ...newClass, id }],
        selectedClassId: id,
        deletedClassIds: (prev.deletedClassIds || []).filter(cId => cId !== id),
        lastModified: Date.now()
      };
      saveStoredData(nextState);
      return nextState;
    });
  };

  const handleUpdateClass = (updatedClass: ClassRoom) => {
    setData(prev => {
      const nextClasses = prev.classes.map(c => (c.id === updatedClass.id ? updatedClass : c));
      const nextState: AppDataState = {
        ...prev,
        classes: nextClasses,
        lastModified: Date.now()
      };
      saveStoredData(nextState);
      return nextState;
    });
    setSyncToast({
      type: 'success',
      message: `Turma "${updatedClass.name}" atualizada e salva!`
    });
    setTimeout(() => setSyncToast(null), 4000);
    setEditingClassModal(null);
  };

  const handleDeleteClass = (classId: string) => {
    markItemDeleted('class', classId);
    setData(prev => {
      const remainingClasses = prev.classes.filter(c => c.id !== classId);
      const nextClass = remainingClasses.find(c => c.academicYearId === prev.selectedYearId) || remainingClasses[0];
      const deletedClassIds = Array.from(new Set([...(prev.deletedClassIds || []), classId]));

      const nextState: AppDataState = {
        ...prev,
        classes: remainingClasses,
        selectedClassId: nextClass?.id || '',
        students: prev.students.filter(s => s.classId !== classId),
        assessments: prev.assessments.filter(a => a.classId !== classId),
        attendances: prev.attendances.filter(a => a.classId !== classId),
        lessons: prev.lessons.filter(l => l.classId !== classId),
        deletedClassIds,
        lastModified: Date.now()
      };
      saveStoredData(nextState);
      return nextState;
    });
  };

  const handleAddStudent = (newStudent: Omit<Student, 'id'>) => {
    const id = `std-${Date.now()}`;
    clearDeletedId('student', id);
    setData(prev => {
      const nextState: AppDataState = {
        ...prev,
        students: [...prev.students, { ...newStudent, id }],
        deletedStudentIds: (prev.deletedStudentIds || []).filter(sId => sId !== id),
        lastModified: Date.now()
      };
      saveStoredData(nextState);
      return nextState;
    });
  };

  const handleImportStudentsBatch = (newStudentsList: Omit<Student, 'id'>[], replaceExisting: boolean) => {
    setData(prev => {
      let updatedStudents = [...prev.students];
      if (replaceExisting) {
        updatedStudents = updatedStudents.filter(s => s.classId !== currentClass.id);
      }
      const added: Student[] = newStudentsList.map((s, idx) => ({
        ...s,
        id: `std-${Date.now()}-${idx}`
      }));
      const nextState: AppDataState = {
        ...prev,
        students: [...updatedStudents, ...added],
        lastModified: Date.now()
      };
      saveStoredData(nextState);
      return nextState;
    });
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setData(prev => ({
      ...prev,
      students: prev.students.map(s => (s.id === updatedStudent.id ? updatedStudent : s)),
      lastModified: Date.now()
    }));
  };

  const handleDeleteStudent = (studentId: string) => {
    markItemDeleted('student', studentId);
    setData(prev => {
      const nextState: AppDataState = {
        ...prev,
        students: prev.students.filter(s => s.id !== studentId),
        gradeRecords: prev.gradeRecords.filter(gr => gr.studentId !== studentId),
        attendances: prev.attendances.filter(a => a.studentId !== studentId),
        observations: prev.observations.filter(o => o.studentId !== studentId),
        deletedStudentIds: Array.from(new Set([...(prev.deletedStudentIds || []), studentId])),
        lastModified: Date.now()
      };
      saveStoredData(nextState);
      return nextState;
    });
  };

  const activeStudentsCount = currentClass
    ? data.students.filter(s => s.classId === currentClass.id && s.status === 'active').length
    : 0;

  // Protect system: require authenticated user
  if (!currentUser) {
    return (
      <>
        <AuthScreen
          onLoginSuccess={(user) => {
            setCurrentUser(user);
          }}
          syncEmail={syncEmail}
          syncStatus={syncStatus}
          onOpenSyncEmailModal={() => setIsSyncModalOpen(true)}
          onManualSync={handleManualSync}
          onOpenGoogleDriveModal={() => setIsGoogleDriveModalOpen(true)}
          onOpenRecoveryModal={() => setIsRecoveryModalOpen(true)}
        />
        <SyncEmailModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          currentUser={currentUser}
          onSyncEmailChanged={(newEmail) => {
            setSyncEmailState(newEmail);
          }}
          onManualSync={handleManualSync}
          onOpenGoogleDriveModal={() => setIsGoogleDriveModalOpen(true)}
          lastDevice={syncStatus.lastDevice}
          lastUpdated={syncStatus.lastUpdated}
        />
        <GoogleDriveBackupModal
          isOpen={isGoogleDriveModalOpen}
          onClose={() => setIsGoogleDriveModalOpen(false)}
          data={data}
          onRestoreData={(restoredData) => {
            setData(restoredData);
            saveStoredData(restoredData);
            setSyncToast({
              message: 'Dados e cadastros restaurados com sucesso do Google Drive!',
              type: 'success'
            });
            setTimeout(() => setSyncToast(null), 5000);
          }}
          activeEmail={syncEmail || 'lab.tecnologia.amparo@gmail.com'}
          isQuotaExceeded={syncStatus.isQuotaExceeded || isQuotaCurrentlyBlocked()}
        />
        <UserRecoveryModal
          isOpen={isRecoveryModalOpen}
          onClose={() => setIsRecoveryModalOpen(false)}
          currentUser={currentUser}
          onDataChanged={(newData) => {
            setData(newData);
            saveStoredData(newData);
          }}
          onOpenGoogleDriveModal={() => {
            setIsRecoveryModalOpen(false);
            setIsGoogleDriveModalOpen(true);
          }}
        />
        {syncToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
            <div
              className={`p-4 rounded-2xl shadow-xl flex items-center gap-3 border ${
                syncToast.type === 'success'
                  ? 'bg-emerald-900/90 text-white border-emerald-500'
                  : 'bg-rose-900/90 text-white border-rose-500'
              }`}
            >
              {syncToast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              )}
              <span className="text-xs font-semibold">{syncToast.message}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        academicYears={data.academicYears}
        selectedYearId={data.selectedYearId}
        onSelectYear={handleSelectYear}
        classes={accessibleClasses}
        selectedClassId={data.selectedClassId}
        onSelectClass={handleSelectClass}
        onEditClass={(c) => setEditingClassModal(c)}
        selectedTerm={data.selectedTerm}
        onSelectTerm={handleSelectTerm}
        onResetData={handleResetData}
        onExportData={handleExportData}
        onImportData={handleImportData}
        currentUser={currentUser}
        onLogout={handleLogout}
        onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        syncStatus={syncStatus}
        onManualSync={handleManualSync}
        syncEmail={syncEmail}
        onOpenSyncEmailModal={() => setIsSyncModalOpen(true)}
        onOpenGoogleDriveModal={() => setIsGoogleDriveModalOpen(true)}
        onOpenRecoveryModal={() => setIsRecoveryModalOpen(true)}
        onShowQuotaAlert={() => setIsQuotaAlertDismissed(false)}
      />

      {/* Main Tabs Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        studentCount={activeStudentsCount}
        incidentCount={currentClass ? (data.incidents || []).filter(i => i.classId === currentClass.id).length : 0}
        isAdmin={currentUser?.role === 'admin'}
      />

      {/* Quota Exceeded Friendly Informational Banner */}
      {(syncStatus.isQuotaExceeded || isQuotaCurrentlyBlocked()) && !isQuotaAlertDismissed && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3 w-full">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  <span>Limite de Sincronização em Nuvem (Firestore) Excedido Hoje</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200/80 text-amber-900 border border-amber-300">
                    Spark Free Tier
                  </span>
                </h4>
                <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                  O limite diário de gravações gratuitas do Google Cloud Firestore foi atingido hoje para este projeto.
                  <strong className="block mt-1 font-semibold text-emerald-900">
                    Seus dados estão 100% seguros: todas as turmas, alunos, notas, chamadas e conteúdos continuam salvos e funcionando normalmente na memória deste dispositivo (Local Storage).
                  </strong>
                  Você pode salvar cópias de segurança a qualquer momento diretamente no seu <strong>Google Drive</strong> (sem limite de cota) e restaurá-las com 1 clique.
                </p>
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-2 self-end md:self-center shrink-0">
              <button
                type="button"
                onClick={() => setIsGoogleDriveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                title="Salvar cópia completa ou importar pelo seu Google Drive"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Google Drive (Backup & Restaurar)</span>
              </button>
              <a
                href={FIRESTORE_UPGRADE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition"
              >
                <span>Console Firebase</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => {
                  clearQuotaExceeded();
                  handleManualSync();
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100/70 text-amber-900 border border-amber-300 font-bold text-xs transition cursor-pointer"
              >
                Tentar Sincronizar
              </button>
              <button
                type="button"
                onClick={() => setIsQuotaAlertDismissed(true)}
                className="text-amber-600 hover:text-amber-900 px-2 py-1 font-bold text-xs cursor-pointer ml-1"
                title="Fechar este aviso temporariamente"
              >
                ✕ Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Toast Feedback Banner */}
      {syncToast && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3 w-full">
          <div className={`p-3 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold shadow-xs border transition animate-in fade-in slide-in-from-top-2 duration-200 ${
            syncToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : syncToast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}>
            <div className="flex items-center gap-2">
              {syncToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{syncToast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncToast(null)}
              className="text-slate-400 hover:text-slate-700 p-1 font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!currentClass ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              {currentUser?.role === 'professor' && currentUser.assignedClassIds && currentUser.assignedClassIds.length === 0
                ? 'Nenhuma turma atribuída ao seu perfil'
                : 'Nenhuma turma disponível'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">
              {currentUser?.role === 'professor'
                ? 'Solicite ao administrador da escola a liberação das turmas que você leciona para iniciar os lançamentos pedagógicos.'
                : 'Comece cadastrando sua primeira turma na aba de configurações.'}
            </p>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('management')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Ir para Cadastros
              </button>
            )}
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewDashboard
                currentClass={currentClass}
                students={data.students}
                assessments={data.assessments}
                gradeRecords={data.gradeRecords}
                termRecoveries={data.termRecoveries || []}
                finalRecoveries={data.finalRecoveries || []}
                attendances={data.attendances}
                lessons={data.lessons}
                selectedTerm={data.selectedTerm}
                onNavigateToStudent={(studentId) => {
                  setSelectedStudentId(studentId);
                  setActiveTab('reports');
                }}
                onNavigateToTab={(tab) => setActiveTab(tab)}
                onEditClass={(c) => setEditingClassModal(c)}
              />
            )}

            {activeTab === 'grade-map' && (
              <GradeMap
                currentClass={currentClass}
                students={data.students}
                assessments={data.assessments}
                gradeRecords={data.gradeRecords}
                termRecoveries={data.termRecoveries || []}
                finalRecoveries={data.finalRecoveries || []}
                selectedTerm={data.selectedTerm}
                onUpdateGrade={handleUpdateGrade}
                onUpdateTermRecovery={handleUpdateTermRecovery}
                onUpdateFinalRecovery={handleUpdateFinalRecovery}
                onAddAssessment={handleAddAssessment}
                onDeleteAssessment={handleDeleteAssessment}
                onSelectStudent={(studentId) => {
                  setSelectedStudentId(studentId);
                  setActiveTab('reports');
                }}
                onUpdateCalculationType={(calcType) => {
                  handleUpdateClass({
                    ...currentClass,
                    gradeCalculationType: calcType
                  });
                }}
                onUpdateRecoveryFormula={(formula) => {
                  handleUpdateClass({
                    ...currentClass,
                    annualRecoveryFormula: formula
                  });
                }}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceSystem
                currentClass={currentClass}
                students={data.students}
                attendances={data.attendances}
                selectedTerm={data.selectedTerm}
                onSaveAttendance={handleSaveAttendance}
                onDeleteAttendanceDate={handleDeleteAttendanceDate}
                onSelectTerm={handleSelectTerm}
              />
            )}

            {activeTab === 'lessons' && (
              <LessonDiary
                currentClass={currentClass}
                lessons={data.lessons}
                selectedTerm={data.selectedTerm}
                onAddLesson={handleAddLesson}
                onUpdateLesson={handleUpdateLesson}
                onDeleteLesson={handleDeleteLesson}
                onSelectTerm={handleSelectTerm}
              />
            )}

            {activeTab === 'book-checks' && (
              <BookCorrectionTracker
                currentClass={currentClass}
                students={data.students}
                academicYearTitle={currentYear?.title || 'Ano Letivo 2026'}
                selectedTerm={data.selectedTerm}
                bookAssignments={data.bookAssignments || []}
                studentBookChecks={data.studentBookChecks || []}
                onAddAssignment={handleAddBookAssignment}
                onUpdateAssignment={handleUpdateBookAssignment}
                onDeleteAssignment={handleDeleteBookAssignment}
                onUpdateBookCheck={handleUpdateStudentBookCheck}
                onBatchUpdateBookChecks={handleBatchUpdateStudentBookChecks}
                onSelectTerm={handleSelectTerm}
              />
            )}

            {activeTab === 'student-list' && (
              <StudentListGenerator
                currentClass={currentClass}
                students={data.students}
                assessments={data.assessments}
                gradeRecords={data.gradeRecords}
                attendances={data.attendances}
                selectedTerm={data.selectedTerm}
                onUpdateStudent={handleUpdateStudent}
                onAddStudent={handleAddStudent}
                onDeleteStudent={handleDeleteStudent}
              />
            )}

            {activeTab === 'incidents' && (
              <StudentIncidents
                currentClass={currentClass}
                students={data.students}
                incidents={data.incidents || []}
                incidentTypes={data.incidentTypes || []}
                selectedTerm={data.selectedTerm}
                onAddIncident={handleAddIncident}
                onUpdateIncident={handleUpdateIncident}
                onDeleteIncident={handleDeleteIncident}
                onAddIncidentType={handleAddIncidentType}
                onDeleteIncidentType={handleDeleteIncidentType}
                isAdmin={currentUser?.role === 'admin'}
              />
            )}

            {activeTab === 'reports' && (
              <StudentReport
                currentClass={currentClass}
                students={data.students}
                assessments={data.assessments}
                gradeRecords={data.gradeRecords}
                termRecoveries={data.termRecoveries || []}
                finalRecoveries={data.finalRecoveries || []}
                attendances={data.attendances}
                lessons={data.lessons}
                observations={data.observations}
                selectedStudentId={selectedStudentId}
                onSelectStudentId={setSelectedStudentId}
                onSaveObservation={handleSaveObservation}
                selectedTerm={data.selectedTerm}
                teacherName={currentUser?.name}
                onUpdateStudent={handleUpdateStudent}
              />
            )}

            {activeTab === 'management' && (
              <ManagementModal
                academicYears={data.academicYears}
                classes={data.classes}
                students={data.students}
                selectedYearId={data.selectedYearId}
                selectedClassId={data.selectedClassId}
                onAddYear={handleAddYear}
                onUpdateYear={handleUpdateYear}
                onDeleteYear={handleDeleteYear}
                onAddClass={handleAddClass}
                onUpdateClass={handleUpdateClass}
                onDeleteClass={handleDeleteClass}
                onAddStudent={handleAddStudent}
                onUpdateStudent={handleUpdateStudent}
                onDeleteStudent={handleDeleteStudent}
                onImportStudentsBatch={handleImportStudentsBatch}
                currentUser={currentUser}
              />
            )}
          </>
        )}
      </main>

      {/* Footer (hidden in print) */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Diário do Professor • Controle Escolar & Pedagógico</span>
          <span className="text-slate-400">
            Conforme diretrizes da BNCC e LDB • Sincronização em nuvem ativa ({syncEmail})
          </span>
        </div>
      </footer>

      {/* Cloud Sync Email Selection Modal */}
      <SyncEmailModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        currentUser={currentUser}
        onSyncEmailChanged={(newEmail) => {
          setSyncEmailState(newEmail);
        }}
        onManualSync={handleManualSync}
        onOpenGoogleDriveModal={() => setIsGoogleDriveModalOpen(true)}
        lastDevice={syncStatus.lastDevice}
        lastUpdated={syncStatus.lastUpdated}
      />

      {/* Edit Class Modal */}
      <EditClassModal
        isOpen={!!editingClassModal}
        onClose={() => setEditingClassModal(null)}
        classRoom={editingClassModal}
        academicYears={data.academicYears}
        onSave={handleUpdateClass}
      />

      {/* Google Drive Direct Backup & Restore Modal */}
      <GoogleDriveBackupModal
        isOpen={isGoogleDriveModalOpen}
        onClose={() => setIsGoogleDriveModalOpen(false)}
        data={data}
        onRestoreData={(restoredData) => {
          setData(restoredData);
          saveStoredData(restoredData);
          setSyncToast({
            message: 'Dados restaurados com sucesso do Google Drive!',
            type: 'success'
          });
          setTimeout(() => setSyncToast(null), 5000);
        }}
        activeEmail={syncEmail || currentUser?.email || 'lab.tecnologia.amparo@gmail.com'}
        isQuotaExceeded={syncStatus.isQuotaExceeded || isQuotaCurrentlyBlocked()}
      />

      {/* User & Student Recovery Central Modal */}
      <UserRecoveryModal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        currentUser={currentUser}
        onDataChanged={(newData) => {
          setData(newData);
          saveStoredData(newData);
        }}
        onOpenGoogleDriveModal={() => {
          setIsRecoveryModalOpen(false);
          setIsGoogleDriveModalOpen(true);
        }}
      />
    </div>
  );
}
