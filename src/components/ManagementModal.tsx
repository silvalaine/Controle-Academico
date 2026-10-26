import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Layers,
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Image as ImageIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AcademicYear, ClassRoom, Student, StudentStatus, TermType, AnnualRecoveryFormula, User, TermPeriod } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { generateStudentListPDF } from '../utils/pdfGenerator';
import { UserManagement } from './UserManagement';
import { SchoolLogoSelector } from './SchoolLogoSelector';
import { TermPeriodsEditor } from './TermPeriodsEditor';
import { getDefaultTermPeriods, formatPeriodRange } from '../utils/calculations';
import {
  getSchoolLogo,
  getSchoolName,
  getIncludeSchoolLogoPreference,
  subscribeSchoolConfig
} from '../utils/schoolLogo';

interface ManagementProps {
  academicYears: AcademicYear[];
  classes: ClassRoom[];
  students: Student[];
  selectedYearId: string;
  selectedClassId: string;
  onAddYear: (year: Omit<AcademicYear, 'id'>) => void;
  onUpdateYear: (year: AcademicYear) => void;
  onDeleteYear: (yearId: string) => void;
  onAddClass: (newClass: Omit<ClassRoom, 'id'>) => void;
  onUpdateClass: (classRoom: ClassRoom) => void;
  onDeleteClass: (classId: string) => void;
  onAddStudent: (newStudent: Omit<Student, 'id'>) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onImportStudentsBatch?: (newStudents: Omit<Student, 'id'>[], replaceExisting: boolean) => void;
  currentUser?: User;
  initialSection?: 'students' | 'classes' | 'years' | 'users' | 'school';
}

export const ManagementModal: React.FC<ManagementProps> = ({
  academicYears,
  classes,
  students,
  selectedYearId,
  selectedClassId,
  onAddYear,
  onUpdateYear,
  onDeleteYear,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onImportStudentsBatch,
  currentUser,
  initialSection = 'students'
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [activeSection, setActiveSection] = useState<'students' | 'classes' | 'years' | 'users' | 'school'>(initialSection);

  // School Identity & Logo Configuration State
  const [includeLogo, setIncludeLogo] = useState<boolean>(() => getIncludeSchoolLogoPreference());
  const [schoolLogo, setSchoolLogoState] = useState<string | null>(() => getSchoolLogo());
  const [schoolName, setSchoolNameState] = useState<string>(() => getSchoolName());

  useEffect(() => {
    const unsub = subscribeSchoolConfig(() => {
      setIncludeLogo(getIncludeSchoolLogoPreference());
      setSchoolLogoState(getSchoolLogo());
      setSchoolNameState(getSchoolName());
    });
    return unsub;
  }, []);

  // Deletion modals state
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [classToDelete, setClassToDelete] = useState<ClassRoom | null>(null);
  const [yearToDelete, setYearToDelete] = useState<AcademicYear | null>(null);

  // Sub-forms states
  // Add Student
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [stdName, setStdName] = useState('');
  const [stdRoll, setStdRoll] = useState(1);
  const [stdEnrollment, setStdEnrollment] = useState('');
  const [stdGuardian, setStdGuardian] = useState('');
  const [stdPhone, setStdPhone] = useState('');
  const [stdStatus, setStdStatus] = useState<StudentStatus>('active');

  // Excel Import State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [importedPreview, setImportedPreview] = useState<Omit<Student, 'id'>[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);

  // Add / Edit Class State
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [className, setClassName] = useState('');
  const [classGradeLevel, setClassGradeLevel] = useState('Ensino Fundamental II');
  const [classSubject, setClassSubject] = useState('Matemática');
  const [classShift, setClassShift] = useState<'Matutino' | 'Vespertino' | 'Noturno' | 'Integral'>('Matutino');
  const [classAcademicYearId, setClassAcademicYearId] = useState('');
  const [classPassingGrade, setClassPassingGrade] = useState(6.0);
  const [classPassingRecoveryGrade, setClassPassingRecoveryGrade] = useState(5.0);
  const [classTermType, setClassTermType] = useState<TermType>('bimestral');
  const [classAnnualRecoveryFormula, setClassAnnualRecoveryFormula] = useState<AnnualRecoveryFormula>('rec_final_direta');
  const [classTermPeriods, setClassTermPeriods] = useState<TermPeriod[]>(() => getDefaultTermPeriods('bimestral', 2026));

  // Add Year
  const [isAddingYear, setIsAddingYear] = useState(false);
  const [yearNumber, setYearNumber] = useState(new Date().getFullYear());
  const [yearTitle, setYearTitle] = useState(`Ano Letivo ${new Date().getFullYear()}`);
  const [yearTermType, setYearTermType] = useState<TermType>('bimestral');
  const [yearNotes, setYearNotes] = useState('');

  const currentClass = classes.find(c => c.id === selectedClassId);
  const currentClassStudents = students
    .filter(s => s.classId === selectedClassId)
    .sort((a, b) => a.rollNumber - b.rollNumber);

  // Student Form Handlers
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setStdName('');
    const nextRoll = currentClassStudents.length > 0
      ? Math.max(...currentClassStudents.map(s => s.rollNumber)) + 1
      : 1;
    setStdRoll(nextRoll);
    setStdEnrollment(`2026${String(nextRoll).padStart(3, '0')}`);
    setStdGuardian('');
    setStdPhone('');
    setStdStatus('active');
    setIsAddingStudent(true);
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStdName(student.name);
    setStdRoll(student.rollNumber);
    setStdEnrollment(student.enrollmentNumber);
    setStdGuardian(student.guardianName || '');
    setStdPhone(student.guardianPhone || '');
    setStdStatus(student.status || 'active');
    setIsAddingStudent(true);
  };

  const handleSubmitStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stdName.trim()) return;

    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        name: stdName.trim(),
        rollNumber: Number(stdRoll),
        enrollmentNumber: stdEnrollment.trim(),
        guardianName: stdGuardian.trim() || undefined,
        guardianPhone: stdPhone.trim() || undefined,
        status: stdStatus
      });
    } else {
      onAddStudent({
        classId: selectedClassId,
        rollNumber: Number(stdRoll),
        name: stdName.trim(),
        enrollmentNumber: stdEnrollment.trim() || `MAT-${Date.now().toString().slice(-4)}`,
        guardianName: stdGuardian.trim() || undefined,
        guardianPhone: stdPhone.trim() || undefined,
        status: stdStatus
      });
    }

    setIsAddingStudent(false);
  };

  // Excel Importer Handlers
  const handleDownloadExcelTemplate = () => {
    const templateData = [
      {
        'Numero': 1,
        'Nome': 'Alice Beatriz Carvalho',
        'Matricula': '20260901',
        'Responsavel': 'Marcos Carvalho',
        'Telefone': '(11) 98765-4321'
      },
      {
        'Numero': 2,
        'Nome': 'Bernardo Oliveira Lima',
        'Matricula': '20260902',
        'Responsavel': 'Silvia Oliveira',
        'Telefone': '(11) 97654-3210'
      },
      {
        'Numero': 3,
        'Nome': 'Camila Rodrigues Mendes',
        'Matricula': '20260903',
        'Responsavel': 'Renato Mendes',
        'Telefone': '(11) 96543-2109'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, 'Modelo_Importacao_Alunos.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelError(null);
    setExcelSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          setExcelError('A planilha está vazia ou não possui linhas válidas.');
          return;
        }

        const startRoll = currentClassStudents.length > 0
          ? Math.max(...currentClassStudents.map(s => s.rollNumber)) + 1
          : 1;

        const parsedList: Omit<Student, 'id'>[] = [];

        data.forEach((row, index) => {
          // Normalize column lookup
          const keys = Object.keys(row);
          const findVal = (...aliases: string[]) => {
            for (const alias of aliases) {
              const matchedKey = keys.find(k =>
                k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === alias.toLowerCase()
              );
              if (matchedKey && row[matchedKey] !== undefined) {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const name = findVal('nome', 'aluno', 'estudante', 'nome completo');
          if (!name) return; // Skip rows without name

          const rollVal = findVal('numero', 'n', 'chamada', 'ordem', 'no');
          const rollNumber = rollVal && !isNaN(Number(rollVal)) ? Number(rollVal) : startRoll + index;

          const enrollment = findVal('matricula', 'ra', 'id', 'codigo') || `2026${String(rollNumber).padStart(3, '0')}`;
          const guardian = findVal('responsavel', 'pai', 'mae', 'tutor', 'contato');
          const phone = findVal('telefone', 'celular', 'fone', 'tel', 'whatsapp');

          parsedList.push({
            classId: selectedClassId,
            rollNumber,
            name,
            enrollmentNumber: enrollment,
            guardianName: guardian || undefined,
            guardianPhone: phone || undefined,
            status: 'active'
          });
        });

        if (parsedList.length === 0) {
          setExcelError('Não foi possível identificar a coluna de nomes dos alunos. Verifique se o cabeçalho contém "Nome" ou "Aluno".');
        } else {
          setImportedPreview(parsedList);
        }
      } catch (err) {
        setExcelError('Erro ao ler arquivo Excel: ' + String(err));
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (importedPreview.length === 0) return;

    if (onImportStudentsBatch) {
      onImportStudentsBatch(importedPreview, importMode === 'replace');
    } else {
      // Fallback
      importedPreview.forEach(s => onAddStudent(s));
    }

    setExcelSuccess(`${importedPreview.length} alunos importados com sucesso!`);
    setImportedPreview([]);
    setTimeout(() => {
      setIsExcelModalOpen(false);
      setExcelSuccess(null);
    }, 1500);
  };

  // Class Form Handlers
  const handleOpenAddClass = () => {
    setEditingClass(null);
    setClassName('');
    setClassSubject('Matemática');
    setClassGradeLevel('Ensino Fundamental II');
    setClassShift('Matutino');
    setClassAcademicYearId(selectedYearId);
    setClassPassingGrade(6.0);
    setClassPassingRecoveryGrade(5.0);
    setClassTermType('bimestral');
    setClassAnnualRecoveryFormula('rec_final_direta');
    const yr = academicYears.find(y => y.id === selectedYearId)?.year || new Date().getFullYear();
    setClassTermPeriods(getDefaultTermPeriods('bimestral', yr));
    setIsAddingClass(true);
  };

  const handleOpenEditClass = (c: ClassRoom) => {
    setEditingClass(c);
    setClassName(c.name);
    setClassSubject(c.subject);
    setClassGradeLevel(c.gradeLevel);
    setClassShift(c.shift);
    setClassAcademicYearId(c.academicYearId || selectedYearId);
    setClassPassingGrade(c.passingGrade);
    setClassPassingRecoveryGrade(c.passingRecoveryGrade ?? 5.0);
    setClassTermType(c.termType);
    setClassAnnualRecoveryFormula(c.annualRecoveryFormula || 'rec_final_direta');
    const yr = academicYears.find(y => y.id === (c.academicYearId || selectedYearId))?.year || new Date().getFullYear();
    setClassTermPeriods(c.termPeriods && c.termPeriods.length > 0 ? c.termPeriods : getDefaultTermPeriods(c.termType, yr));
    setIsAddingClass(true);
  };

  const handleCancelClassForm = () => {
    setEditingClass(null);
    setClassName('');
    setIsAddingClass(false);
  };

  const handleSubmitClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim() || !classSubject.trim()) return;

    if (editingClass) {
      onUpdateClass({
        ...editingClass,
        name: className.trim(),
        subject: classSubject.trim(),
        gradeLevel: classGradeLevel.trim(),
        shift: classShift,
        academicYearId: classAcademicYearId || editingClass.academicYearId,
        passingGrade: Number(classPassingGrade) || 6.0,
        passingRecoveryGrade: Number(classPassingRecoveryGrade) || 5.0,
        termType: classTermType,
        annualRecoveryFormula: classAnnualRecoveryFormula,
        termPeriods: classTermPeriods
      });
    } else {
      onAddClass({
        academicYearId: classAcademicYearId || selectedYearId,
        name: className.trim(),
        gradeLevel: classGradeLevel.trim(),
        subject: classSubject.trim(),
        shift: classShift,
        passingGrade: Number(classPassingGrade) || 6.0,
        passingRecoveryGrade: Number(classPassingRecoveryGrade) || 5.0,
        maxGrade: 10.0,
        termType: classTermType,
        gradeCalculationType: 'aritmetica',
        annualRecoveryFormula: classAnnualRecoveryFormula,
        termPeriods: classTermPeriods
      });
    }

    handleCancelClassForm();
  };

  // Year Form Handlers
  const handleSubmitYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearTitle.trim()) return;

    onAddYear({
      year: Number(yearNumber),
      title: yearTitle.trim(),
      termType: yearTermType,
      isActive: true,
      notes: yearNotes.trim() || undefined
    });

    setIsAddingYear(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Section Nav Tabs */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              Cadastros & Configurações da Escola
            </h2>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'
            }`}>
              {isAdmin ? 'Acesso Total (Administrador)' : 'Apenas Consulta (Professor)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Gerencie estudantes, turmas, anos letivos e cadastre novos usuários e professores.'
              : 'Consulte estudantes, turmas e anos letivos cadastrados pelo administrador da escola.'}
          </p>
        </div>

        <div className="flex items-center flex-wrap bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
          <button
            onClick={() => setActiveSection('students')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSection === 'students'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Alunos ({currentClassStudents.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('classes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSection === 'classes'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Turmas ({classes.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('years')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSection === 'years'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Anos Letivos ({academicYears.length})</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveSection('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeSection === 'users'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-indigo-700 hover:bg-indigo-50 font-bold'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Usuários & Professores</span>
            </button>
          )}

          <button
            onClick={() => setActiveSection('school')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSection === 'school'
                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Identidade & Logo da Escola</span>
          </button>
        </div>
      </div>

      {/* Professor Restriction Notice */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-900 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="block font-bold">Acesso Restrito: Modo Consulta para Professores</strong>
            Conforme as regras do sistema, somente o <strong>Administrador</strong> possui autorização para cadastrar novos usuários, turmas, anos letivos e alunos. O professor utiliza os dados já cadastrados para lançamentos pedagógicos.
          </div>
        </div>
      )}

      {/* SECTION 1: STUDENTS */}
      {activeSection === 'students' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Alunos Matriculados em {currentClass?.name || 'Turma Selecionada'}
              </h3>
              <p className="text-xs text-slate-500">
                {currentClass?.subject} • Turno {currentClass?.shift}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Gerar Lista da Turma Button */}
              {currentClass && (
                <button
                  type="button"
                  onClick={() => generateStudentListPDF(currentClass, students, 'chamada')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs"
                  title="Gerar e baixar lista de chamada de alunos em PDF"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Gerar Lista (PDF)</span>
                </button>
              )}

              {/* Import Excel & Add Student Buttons (Admin Only) */}
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setImportedPreview([]);
                      setExcelError(null);
                      setExcelSuccess(null);
                      setIsExcelModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                    title="Importar lista de estudantes a partir de um arquivo Excel (.xlsx, .xls, .csv)"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Importar do Excel</span>
                  </button>

                  <button
                    onClick={handleOpenAddStudent}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo Aluno</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Student Add/Edit Modal */}
          {isAddingStudent && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-bold text-indigo-900 mb-3">
                {editingStudent ? 'Editar Dados do Aluno' : 'Cadastrar Novo Aluno na Turma'}
              </h4>

              <form onSubmit={handleSubmitStudent} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nome Completo do Aluno *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Gabriela Vasconcelos"
                    value={stdName}
                    onChange={(e) => setStdName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nº de Chamada
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={stdRoll}
                    onChange={(e) => setStdRoll(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Matrícula Escolar
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 20260901"
                    value={stdEnrollment}
                    onChange={(e) => setStdEnrollment(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nome do Responsável
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Mariana Vasconcelos"
                    value={stdGuardian}
                    onChange={(e) => setStdGuardian(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 98765-4321"
                    value={stdPhone}
                    onChange={(e) => setStdPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Situação / Status do Aluno
                  </label>
                  <select
                    value={stdStatus}
                    onChange={(e) => setStdStatus(e.target.value as StudentStatus)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="active">Ativo (Frequentando)</option>
                    <option value="canceled">Cancelado (Saiu da escola / Matrícula cancelada)</option>
                    <option value="transferred">Transferido (Mudou de escola/turma)</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex justify-end items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingStudent(false)}
                    className="px-3.5 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold shadow-xs"
                  >
                    {editingStudent ? 'Atualizar Aluno' : 'Salvar Aluno'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Excel Import Modal */}
          {isExcelModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    Importar Alunos via Planilha Excel (.xlsx, .xls, .csv)
                  </h3>
                  <button
                    onClick={() => setIsExcelModalOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    Fechar
                  </button>
                </div>

                <p className="text-xs text-slate-500 mb-4">
                  Importe a lista de estudantes diretamente para a turma <strong>{currentClass?.name}</strong>.
                </p>

                {/* Template download and info */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Colunas suportadas na planilha:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      <strong>Nome</strong> (obrigatório), <strong>Numero</strong>, <strong>Matricula</strong>, <strong>Responsavel</strong>, <strong>Telefone</strong>.
                    </span>
                  </div>

                  <button
                    onClick={handleDownloadExcelTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shrink-0 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Baixar Modelo Excel</span>
                  </button>
                </div>

                {/* File Dropzone Input */}
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer transition bg-slate-50/50 mb-4 relative">
                  <Upload className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">
                    Clique aqui para selecionar seu arquivo Excel ou arraste-o
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Formatos aceitos: .xlsx, .xls, .csv
                  </p>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>

                {/* Feedback Alerts */}
                {excelError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{excelError}</span>
                  </div>
                )}

                {excelSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2 mb-4">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{excelSuccess}</span>
                  </div>
                )}

                {/* Preview Table */}
                {importedPreview.length > 0 && (
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        {importedPreview.length} aluno(s) identificado(s) na planilha:
                      </span>

                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1 text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'append'}
                            onChange={() => setImportMode('append')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Adicionar aos existentes</span>
                        </label>
                        <label className="flex items-center gap-1 text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Substituir turma</span>
                        </label>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 sticky top-0 font-bold text-slate-600">
                          <tr>
                            <th className="py-2 px-2 text-center">Nº</th>
                            <th className="py-2 px-3">Nome do Aluno</th>
                            <th className="py-2 px-2">Matrícula</th>
                            <th className="py-2 px-2">Responsável</th>
                            <th className="py-2 px-2">Telefone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importedPreview.map((s, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2 text-center font-bold text-slate-500">
                                {s.rollNumber}
                              </td>
                              <td className="py-1.5 px-3 font-semibold text-slate-800">
                                {s.name}
                              </td>
                              <td className="py-1.5 px-2 text-slate-500">
                                {s.enrollmentNumber}
                              </td>
                              <td className="py-1.5 px-2 text-slate-500">
                                {s.guardianName || '—'}
                              </td>
                              <td className="py-1.5 px-2 text-slate-500">
                                {s.guardianPhone || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setIsExcelModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-600 font-semibold rounded-lg hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={importedPreview.length === 0}
                    className="px-4 py-2 text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-bold rounded-lg shadow-xs transition"
                  >
                    Confirmar e Importar {importedPreview.length > 0 ? `(${importedPreview.length})` : ''}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Student List Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">Nº</th>
                  <th className="py-2.5 px-4">Nome do Aluno</th>
                  <th className="py-2.5 px-3">Matrícula</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Telefone</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentClassStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                      {String(s.rollNumber).padStart(2, '0')}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {s.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {s.enrollmentNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {s.guardianName || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {s.guardianPhone || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isAdmin ? (
                        <select
                          value={s.status || 'active'}
                          onChange={(e) => onUpdateStudent({ ...s, status: e.target.value as StudentStatus })}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none transition ${
                            s.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : s.status === 'canceled'
                              ? 'bg-rose-50 text-rose-800 border-rose-300 font-extrabold'
                              : s.status === 'transferred'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                          title="Alterar situação da matrícula do aluno (Ativo, Cancelado, Transferido)"
                        >
                          <option value="active">Ativo</option>
                          <option value="canceled">Cancelado (Saiu)</option>
                          <option value="transferred">Transferido</option>
                          <option value="inactive">Inativo</option>
                        </select>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'canceled'
                            ? 'bg-rose-100 text-rose-800 font-extrabold'
                            : s.status === 'transferred'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {s.status === 'active' ? 'Ativo' :
                           s.status === 'canceled' ? 'Cancelado' :
                           s.status === 'transferred' ? 'Transferido' : 'Inativo'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditStudent(s)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition"
                            title="Editar Aluno"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setStudentToDelete(s)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Excluir Aluno"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">Consulta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: CLASSES */}
      {activeSection === 'classes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Turmas Cadastradas
              </h3>
              <p className="text-xs text-slate-500">
                Vincule turmas a disciplinas, turnos e regras de avaliação bimestral ou trimestral.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={handleOpenAddClass}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Turma</span>
              </button>
            )}
          </div>

          {/* Add / Edit Class Form */}
          {isAddingClass && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  {editingClass ? (
                    <>
                      <Edit2 className="w-4 h-4 text-indigo-600" />
                      <span>Editar Turma: {editingClass.name}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-indigo-600" />
                      <span>Cadastrar Nova Turma</span>
                    </>
                  )}
                </h4>
                {editingClass && (
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                    Modo Edição
                  </span>
                )}
              </div>

              <form onSubmit={handleSubmitClass} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nome da Turma *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 9º Ano A, 1º EM B, Módulo II"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Disciplina *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Matemática, Robótica, Geral"
                    value={classSubject}
                    onChange={(e) => setClassSubject(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nível / Etapa de Ensino
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ensino Fundamental II"
                    value={classGradeLevel}
                    onChange={(e) => setClassGradeLevel(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Turno
                  </label>
                  <select
                    value={classShift}
                    onChange={(e) => setClassShift(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="Matutino">Matutino</option>
                    <option value="Vespertino">Vespertino</option>
                    <option value="Noturno">Noturno</option>
                    <option value="Integral">Integral</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ano Letivo Vinculado
                  </label>
                  <select
                    value={classAcademicYearId || selectedYearId}
                    onChange={(e) => setClassAcademicYearId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>
                        {y.title} {y.isActive ? '(Ativo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Modelo de Período Letivo *
                  </label>
                  <select
                    value={classTermType}
                    onChange={(e) => setClassTermType(e.target.value as TermType)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                  >
                    <option value="bimestral">Bimestral (4 Bimestres)</option>
                    <option value="trimestral">Trimestral (3 Trimestres)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Média de Aprovação
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={classPassingGrade}
                    onChange={(e) => setClassPassingGrade(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Fórmula de Recuperação Final
                  </label>
                  <select
                    value={classAnnualRecoveryFormula}
                    onChange={(e) => setClassAnnualRecoveryFormula(e.target.value as AnnualRecoveryFormula)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="rec_final_direta">Repetir Nota da Rec. Final (Padrão)</option>
                    <option value="substituicao">Substituição se Maior: max(Anual, Rec)</option>
                    <option value="media_aritmetica">Média Aritmética: (Anual + Rec) ÷ 2</option>
                    <option value="media_ponderada">Média Ponderada: (Anual × 6 + Rec × 4) ÷ 10</option>
                    <option value="substitui_menor_bimestre">Substituição da Menor Nota Bimestral</option>
                  </select>
                </div>

                {/* Term Periods (Bimestres / Trimestres) Início e Término */}
                <div className="md:col-span-3 pt-2">
                  <TermPeriodsEditor
                    termType={classTermType}
                    termPeriods={classTermPeriods}
                    onChange={setClassTermPeriods}
                    academicYearNumber={academicYears.find(y => y.id === (classAcademicYearId || selectedYearId))?.year || 2026}
                  />
                </div>

                <div className="md:col-span-3 flex justify-end gap-2 pt-2 border-t border-indigo-100">
                  <button
                    type="button"
                    onClick={handleCancelClassForm}
                    className="px-3.5 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{editingClass ? 'Atualizar Turma' : 'Salvar Turma'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Classes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {classes.map((c) => {
              const studentCount = students.filter(s => s.classId === c.id && s.status === 'active').length;
              const isSelected = c.id === selectedClassId;

              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-xl p-5 border shadow-xs transition flex flex-col justify-between ${
                    isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                        {c.gradeLevel}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                        {c.termType}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900">
                      {c.name} - {c.subject}
                    </h4>

                    <p className="text-xs text-slate-500 mt-1">
                      Turno: <strong>{c.shift}</strong> • Média Mínima: <strong>{c.passingGrade.toFixed(1)}</strong>
                    </p>

                    {/* Term Periods Summary */}
                    {c.termPeriods && c.termPeriods.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                          <span>Períodos dos {c.termType === 'bimestral' ? 'Bimestres' : 'Trimestres'}</span>
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          {c.termPeriods.map(p => (
                            <span key={p.term} className="bg-slate-50 border border-slate-200/60 rounded px-1.5 py-0.5 text-slate-600 text-[10px] truncate" title={`${p.term}º: ${formatPeriodRange(p.startDate, p.endDate)}`}>
                              <strong className="text-slate-800">{p.term}º:</strong> {formatPeriodRange(p.startDate, p.endDate)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">
                        {studentCount} aluno(s)
                      </span>
                      {isSelected && (
                        <span className="text-indigo-600 font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Turma Atual
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditClass(c)}
                      className="text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title={`Editar turma ${c.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Editar Turma</span>
                    </button>

                    {isAdmin && classes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setClassToDelete(c)}
                        className="text-xs text-slate-400 hover:text-rose-600 transition flex items-center gap-1 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-rose-50"
                        title={`Excluir turma ${c.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: ACADEMIC YEARS */}
      {activeSection === 'years' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Anos Letivos
              </h3>
              <p className="text-xs text-slate-500">
                Gerencie os calendários letivos anuais e organize seus registros históricos.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsAddingYear(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Ano Letivo</span>
              </button>
            )}
          </div>

          {/* Add Year Form */}
          {isAddingYear && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-bold text-indigo-900 mb-3">
                Cadastrar Novo Ano Letivo
              </h4>

              <form onSubmit={handleSubmitYear} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ano Numérico *
                  </label>
                  <input
                    type="number"
                    required
                    value={yearNumber}
                    onChange={(e) => setYearNumber(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Título / Identificação *
                  </label>
                  <input
                    type="text"
                    required
                    value={yearTitle}
                    onChange={(e) => setYearTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Regime Padrão
                  </label>
                  <select
                    value={yearTermType}
                    onChange={(e) => setYearTermType(e.target.value as TermType)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="bimestral">Bimestral (4 Bimestres)</option>
                    <option value="trimestral">Trimestral (3 Trimestres)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Observações
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Calendário regular estadual"
                    value={yearNotes}
                    onChange={(e) => setYearNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-4 flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingYear(false)}
                    className="px-3.5 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold shadow-xs"
                  >
                    Salvar Ano Letivo
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Years List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {academicYears.map((y) => (
              <div
                key={y.id}
                className={`bg-white rounded-xl p-5 border shadow-xs transition flex flex-col justify-between ${
                  y.id === selectedYearId ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-black text-slate-900">{y.year}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      y.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {y.isActive ? 'Ano Ativo' : 'Arquivado'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-800">{y.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modelo: <strong className="capitalize">{y.termType}</strong>
                  </p>
                  {y.notes && (
                    <p className="text-[11px] text-slate-400 mt-2 italic bg-slate-50 p-2 rounded">
                      {y.notes}
                    </p>
                  )}
                </div>

                {isAdmin ? (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => onUpdateYear({ ...y, isActive: !y.isActive })}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      {y.isActive ? 'Arquivar' : 'Marcar como Ativo'}
                    </button>

                    {academicYears.length > 1 && (
                      <button
                        onClick={() => setYearToDelete(y)}
                        className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Excluir ano letivo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
                    {y.isActive ? 'Ano Letivo Vigente' : 'Ano Letivo Arquivado'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: USERS & PROFESSORS (ADMIN ONLY) */}
      {activeSection === 'users' && isAdmin && currentUser && (
        <UserManagement currentUser={currentUser} classes={classes} />
      )}

      {/* SECTION 5: SCHOOL IDENTITY & LOGO */}
      {activeSection === 'school' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="max-w-3xl">
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                Identidade Visual e Logo da Escola
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Configure aqui o logotipo e o nome oficial da escola. As alterações salvas serão aplicadas automaticamente em todos os relatórios, diários de classe, boletins individuais, listas de chamada e mapas de notas emitidos pelo sistema.
              </p>

              <SchoolLogoSelector
                includeLogo={includeLogo}
                onToggleIncludeLogo={setIncludeLogo}
                currentLogo={schoolLogo}
                onLogoChange={setSchoolLogoState}
                schoolName={schoolName}
                onSchoolNameChange={setSchoolNameState}
                showSchoolNameInput={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals for Management Deletions */}
      <ConfirmModal
        isOpen={!!studentToDelete}
        title="Excluir Estudante"
        message={`Deseja realmente excluir o estudante "${studentToDelete?.name}"? Todas as suas notas e registros de presença nesta turma serão apagados.`}
        confirmLabel="Sim, Excluir Aluno"
        onConfirm={() => {
          if (studentToDelete) {
            onDeleteStudent(studentToDelete.id);
            setStudentToDelete(null);
          }
        }}
        onCancel={() => setStudentToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!classToDelete}
        title="Excluir Turma"
        message={`Tem certeza que deseja excluir a turma "${classToDelete?.name}"? Todos os alunos, notas, frequências e conteúdos vinculados serão excluídos permanentemente.`}
        confirmLabel="Sim, Excluir Turma"
        onConfirm={() => {
          if (classToDelete) {
            onDeleteClass(classToDelete.id);
            setClassToDelete(null);
          }
        }}
        onCancel={() => setClassToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!yearToDelete}
        title="Excluir Ano Letivo"
        message={`Tem certeza que deseja excluir o ano letivo ${yearToDelete?.year}? Todas as turmas e dados vinculados a este ano letivo serão apagados.`}
        confirmLabel="Sim, Excluir Ano Letivo"
        onConfirm={() => {
          if (yearToDelete) {
            onDeleteYear(yearToDelete.id);
            setYearToDelete(null);
          }
        }}
        onCancel={() => setYearToDelete(null)}
      />
    </div>
  );
};
