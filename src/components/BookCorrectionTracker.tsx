import React, { useState, useMemo } from 'react';
import {
  BookCheck,
  Plus,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  FileText,
  Trash2,
  Edit2,
  CheckCheck,
  Search,
  Filter,
  Users,
  Award,
  BookOpen,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ClassRoom,
  Student,
  BookAssignment,
  StudentBookCheck,
  BookCheckStatus
} from '../types';
import {
  getTermLabel,
  validateDateInTerm,
  formatPeriodRange
} from '../utils/calculations';
import { generateBookCorrectionReportPDF } from '../utils/pdfGenerator';
import { ConfirmModal } from './ConfirmModal';
import { SchoolLogoSelector } from './SchoolLogoSelector';
import {
  getSchoolLogo,
  getSchoolName,
  getIncludeSchoolLogoPreference,
  subscribeSchoolConfig
} from '../utils/schoolLogo';

interface BookCorrectionTrackerProps {
  currentClass: ClassRoom;
  students: Student[];
  academicYearTitle: string;
  selectedTerm: number;
  bookAssignments: BookAssignment[];
  studentBookChecks: StudentBookCheck[];
  onAddAssignment: (assignment: Omit<BookAssignment, 'id' | 'createdAt'>) => void;
  onUpdateAssignment: (assignment: BookAssignment) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onUpdateBookCheck: (check: StudentBookCheck) => void;
  onBatchUpdateBookChecks: (checks: StudentBookCheck[]) => void;
  onSelectTerm?: (term: number) => void;
}

export const BookCorrectionTracker: React.FC<BookCorrectionTrackerProps> = ({
  currentClass,
  students,
  academicYearTitle,
  selectedTerm,
  bookAssignments,
  studentBookChecks,
  onAddAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  onUpdateBookCheck,
  onBatchUpdateBookChecks,
  onSelectTerm
}) => {
  const [activeView, setActiveView] = useState<'assignment' | 'matrix'>('assignment');
  const [filterTermOnly, setFilterTermOnly] = useState(true);
  const [searchStudent, setSearchStudent] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'complete'>('all');

  // Selected assignment for "assignment" view
  const classAssignments = useMemo(() => {
    return bookAssignments
      .filter(b => b.classId === currentClass.id)
      .filter(b => !filterTermOnly || b.term === selectedTerm)
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  }, [bookAssignments, currentClass.id, filterTermOnly, selectedTerm]);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');

  // Keep selectedAssignmentId pointing to a valid assignment
  const currentAssignment = useMemo(() => {
    if (selectedAssignmentId) {
      const found = classAssignments.find(a => a.id === selectedAssignmentId);
      if (found) return found;
    }
    return classAssignments[0] || null;
  }, [classAssignments, selectedAssignmentId]);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<BookAssignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<BookAssignment | null>(null);

  // Form Fields
  const [formBookTitle, setFormBookTitle] = useState('Livro Didático - PNLD');
  const [formUnitChapter, setFormUnitChapter] = useState('');
  const [formPages, setFormPages] = useState('');
  const [formAssignedDate, setFormAssignedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formHasScore, setFormHasScore] = useState(false);
  const [formMaxScore, setFormMaxScore] = useState(10.0);

  // School Logo config for PDF
  const [includeLogo, setIncludeLogo] = useState<boolean>(() => getIncludeSchoolLogoPreference());
  const [schoolLogo, setSchoolLogoState] = useState<string | null>(() => getSchoolLogo());
  const [schoolName, setSchoolName] = useState<string>(() => getSchoolName());

  React.useEffect(() => {
    const unsub = subscribeSchoolConfig(() => {
      setIncludeLogo(getIncludeSchoolLogoPreference());
      setSchoolLogoState(getSchoolLogo());
      setSchoolName(getSchoolName());
    });
    return unsub;
  }, []);

  const activeStudents = useMemo(() => {
    return students
      .filter(s => s.classId === currentClass.id && s.status === 'active')
      .sort((a, b) => a.rollNumber - b.rollNumber);
  }, [students, currentClass.id]);

  // Quick Stats
  const stats = useMemo(() => {
    const totalAssignments = classAssignments.length;
    if (totalAssignments === 0 || activeStudents.length === 0) {
      return { totalAssignments: 0, totalChecks: 0, completeRate: 0, pendingStudents: 0 };
    }

    let completeCount = 0;
    let totalChecks = 0;
    const studentsWithIncomplete = new Set<string>();

    activeStudents.forEach(student => {
      classAssignments.forEach(assignment => {
        const chk = studentBookChecks.find(
          c => c.studentId === student.id && c.bookAssignmentId === assignment.id
        );
        totalChecks++;
        if (chk?.status === 'visto_completo') {
          completeCount++;
        } else if (chk?.status === 'incompleto' || chk?.status === 'nao_fez' || !chk) {
          studentsWithIncomplete.add(student.id);
        }
      });
    });

    const completeRate = totalChecks > 0 ? Math.round((completeCount / totalChecks) * 100) : 0;
    return {
      totalAssignments,
      totalChecks,
      completeRate,
      pendingStudents: studentsWithIncomplete.size
    };
  }, [classAssignments, activeStudents, studentBookChecks]);

  // Form Handlers
  const handleOpenAdd = () => {
    setEditingAssignment(null);
    setFormBookTitle('Livro Didático - PNLD');
    setFormUnitChapter('');
    setFormPages('');
    const today = new Date().toISOString().split('T')[0];
    setFormAssignedDate(today);
    setFormDueDate(today);
    setFormDescription('');
    setFormHasScore(false);
    setFormMaxScore(10.0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (assignment: BookAssignment) => {
    setEditingAssignment(assignment);
    setFormBookTitle(assignment.bookTitle);
    setFormUnitChapter(assignment.unitOrChapter);
    setFormPages(assignment.pages);
    setFormAssignedDate(assignment.assignedDate);
    setFormDueDate(assignment.dueDate);
    setFormDescription(assignment.description || '');
    setFormHasScore(!!assignment.maxScore);
    setFormMaxScore(assignment.maxScore || 10.0);
    setIsModalOpen(true);
  };

  // Term detection for form due date
  const formDateValidation = validateDateInTerm(formDueDate, selectedTerm, currentClass);

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBookTitle.trim() || !formUnitChapter.trim()) return;

    const targetTerm = formDateValidation.detectedTerm;

    if (editingAssignment) {
      onUpdateAssignment({
        ...editingAssignment,
        bookTitle: formBookTitle.trim(),
        unitOrChapter: formUnitChapter.trim(),
        pages: formPages.trim() || '—',
        assignedDate: formAssignedDate,
        dueDate: formDueDate,
        term: targetTerm,
        description: formDescription.trim() || undefined,
        maxScore: formHasScore ? Number(formMaxScore) || 10.0 : undefined
      });
    } else {
      onAddAssignment({
        classId: currentClass.id,
        term: targetTerm,
        bookTitle: formBookTitle.trim(),
        unitOrChapter: formUnitChapter.trim(),
        pages: formPages.trim() || '—',
        assignedDate: formAssignedDate,
        dueDate: formDueDate,
        description: formDescription.trim() || undefined,
        maxScore: formHasScore ? Number(formMaxScore) || 10.0 : undefined
      });

      if (targetTerm !== selectedTerm && onSelectTerm) {
        onSelectTerm(targetTerm);
      }
    }

    setIsModalOpen(false);
  };

  // Student Check Actions for currentAssignment
  const handleSetStudentStatus = (studentId: string, status: BookCheckStatus) => {
    if (!currentAssignment) return;

    const existing = studentBookChecks.find(
      c => c.studentId === studentId && c.bookAssignmentId === currentAssignment.id
    );

    const nowStr = new Date().toISOString().split('T')[0];
    const updatedCheck: StudentBookCheck = {
      id: existing ? existing.id : `sbc-${Date.now()}-${studentId}`,
      bookAssignmentId: currentAssignment.id,
      studentId,
      classId: currentClass.id,
      status,
      score: existing?.score ?? (status === 'visto_completo' && currentAssignment.maxScore ? currentAssignment.maxScore : status === 'nao_fez' ? 0 : null),
      checkedAt: nowStr,
      notes: existing?.notes || ''
    };

    onUpdateBookCheck(updatedCheck);
  };

  const handleSetStudentScore = (studentId: string, scoreVal: string) => {
    if (!currentAssignment) return;
    const existing = studentBookChecks.find(
      c => c.studentId === studentId && c.bookAssignmentId === currentAssignment.id
    );
    const num = scoreVal === '' ? null : Number(scoreVal);

    const updatedCheck: StudentBookCheck = {
      id: existing ? existing.id : `sbc-${Date.now()}-${studentId}`,
      bookAssignmentId: currentAssignment.id,
      studentId,
      classId: currentClass.id,
      status: existing?.status || 'visto_completo',
      score: isNaN(num as number) ? null : num,
      checkedAt: existing?.checkedAt || new Date().toISOString().split('T')[0],
      notes: existing?.notes || ''
    };
    onUpdateBookCheck(updatedCheck);
  };

  const handleSetStudentNotes = (studentId: string, notesVal: string) => {
    if (!currentAssignment) return;
    const existing = studentBookChecks.find(
      c => c.studentId === studentId && c.bookAssignmentId === currentAssignment.id
    );

    const updatedCheck: StudentBookCheck = {
      id: existing ? existing.id : `sbc-${Date.now()}-${studentId}`,
      bookAssignmentId: currentAssignment.id,
      studentId,
      classId: currentClass.id,
      status: existing?.status || 'visto_completo',
      score: existing?.score ?? null,
      checkedAt: existing?.checkedAt || new Date().toISOString().split('T')[0],
      notes: notesVal
    };
    onUpdateBookCheck(updatedCheck);
  };

  // Mass Actions
  const handleMarkAllComplete = () => {
    if (!currentAssignment) return;
    const nowStr = new Date().toISOString().split('T')[0];
    const newChecks: StudentBookCheck[] = activeStudents.map(s => {
      const existing = studentBookChecks.find(
        c => c.studentId === s.id && c.bookAssignmentId === currentAssignment.id
      );
      return {
        id: existing ? existing.id : `sbc-${Date.now()}-${s.id}`,
        bookAssignmentId: currentAssignment.id,
        studentId: s.id,
        classId: currentClass.id,
        status: 'visto_completo',
        score: currentAssignment.maxScore ?? existing?.score ?? null,
        checkedAt: nowStr,
        notes: existing?.notes || ''
      };
    });
    onBatchUpdateBookChecks(newChecks);
  };

  // PDF Export
  const handleExportPDF = () => {
    if (!currentAssignment) return;
    generateBookCorrectionReportPDF({
      currentClass,
      academicYearTitle,
      students: activeStudents,
      assignment: currentAssignment,
      checks: studentBookChecks,
      schoolLogoOption: {
        includeLogo,
        schoolLogo,
        schoolName
      }
    });
  };

  const statusConfig: Record<BookCheckStatus, { label: string; badge: string; bg: string; icon: any }> = {
    visto_completo: {
      label: 'Visto Completo',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      bg: 'bg-emerald-500',
      icon: CheckCircle2
    },
    incompleto: {
      label: 'Incompleto / Refazer',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      bg: 'bg-amber-500',
      icon: AlertCircle
    },
    nao_fez: {
      label: 'Não Fez / Não Entregue',
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
      bg: 'bg-rose-500',
      icon: XCircle
    },
    atrasado: {
      label: 'Entregue com Atraso',
      badge: 'bg-purple-50 text-purple-800 border-purple-200',
      bg: 'bg-purple-500',
      icon: Clock
    },
    justificado: {
      label: 'Justificado / Disp.',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      bg: 'bg-slate-400',
      icon: Info
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <BookCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Controle de Correção de Livros & Vistos
                </h2>
                <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full">
                  {currentClass.name} • {getTermLabel(currentClass.termType, selectedTerm)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhamento individual de vistos em livros didáticos, cadernos de atividades e apostilas com notas e apontamentos.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <SchoolLogoSelector
            compact
            includeLogo={includeLogo}
            onToggleIncludeLogo={setIncludeLogo}
            currentLogo={schoolLogo}
            onLogoChange={setSchoolLogoState}
            schoolName={schoolName}
            onSchoolNameChange={setSchoolName}
          />

          {currentAssignment && (
            <button
              onClick={handleExportPDF}
              title="Gerar Ficha Oficial de Correção de Livro em PDF"
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              <span>Gerar PDF</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Correção de Livro</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Tarefas Cadastradas</span>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{stats.totalAssignments}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">% Vistos Completos</span>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-2xl font-black text-emerald-600">{stats.completeRate}%</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Alunos c/ Pendências</span>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{stats.pendingStudents}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total de Alunos</span>
            <p className="text-2xl font-black text-slate-700 mt-0.5">{activeStudents.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveView('assignment')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'assignment'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookCheck className="w-3.5 h-3.5" />
                <span>Por Tarefa / Livro</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('matrix')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'matrix'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Painel Geral da Turma</span>
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-slate-600 text-xs cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={filterTermOnly}
                onChange={(e) => setFilterTermOnly(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Apenas {getTermLabel(currentClass.termType, selectedTerm)}</span>
            </label>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar estudante..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56"
              />
            </div>
          </div>
        </div>

        {classAssignments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-3">
              <BookCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Nenhuma correção de livro cadastrada {filterTermOnly ? `no ${getTermLabel(currentClass.termType, selectedTerm)}` : 'nesta turma'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
              Cadastre os livros didáticos, capítulos ou páginas trabalhadas para fazer o acompanhamento dos vistos e resoluções dos alunos.
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Livro</span>
            </button>
          </div>
        ) : activeView === 'assignment' && currentAssignment ? (
          <div>
            {/* Assignment Selector Carousel / Bar */}
            <div className="p-4 bg-indigo-50/50 border-b border-indigo-100/80">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Selecionar Atividade:
                    </span>
                    <select
                      value={currentAssignment.id}
                      onChange={(e) => setSelectedAssignmentId(e.target.value)}
                      className="bg-white border border-indigo-200 rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {classAssignments.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.unitOrChapter} ({a.bookTitle}) - {a.pages}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Details Card */}
                  <div className="bg-white rounded-xl p-3.5 border border-indigo-100/90 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span>{currentAssignment.bookTitle}</span>
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            {getTermLabel(currentClass.termType, currentAssignment.term)}
                          </span>
                        </h4>
                        <p className="text-xs font-semibold text-indigo-700 mt-0.5">
                          {currentAssignment.unitOrChapter} • <strong className="text-slate-800">{currentAssignment.pages}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(currentAssignment)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Editar atividade de livro"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignmentToDelete(currentAssignment)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Excluir atividade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Solicitado: <strong>{currentAssignment.assignedDate.split('-').reverse().join('/')}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        Data Correção: <strong className="text-indigo-700">{currentAssignment.dueDate.split('-').reverse().join('/')}</strong>
                      </span>
                      {currentAssignment.maxScore && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-bold text-emerald-700">
                            <Award className="w-3.5 h-3.5 text-emerald-600" />
                            Nota Máxima: {currentAssignment.maxScore.toFixed(1)} pts
                          </span>
                        </>
                      )}
                    </div>

                    {currentAssignment.description && (
                      <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {currentAssignment.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mass Actions */}
                <div className="flex flex-row lg:flex-col gap-2 shrink-0 self-end lg:self-center">
                  <button
                    type="button"
                    onClick={handleMarkAllComplete}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Marcar Todos c/ Visto</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Students Table for the Selected Assignment */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">Nº</th>
                    <th className="py-2.5 px-4 min-w-[200px]">Nome do Estudante</th>
                    <th className="py-2.5 px-4 min-w-[320px]">Situação do Visto no Livro</th>
                    {currentAssignment.maxScore && (
                      <th className="py-2.5 px-3 text-center w-24">Nota / Pts</th>
                    )}
                    <th className="py-2.5 px-4 min-w-[220px]">Apontamentos / Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeStudents
                    .filter(s => !searchStudent || s.name.toLowerCase().includes(searchStudent.toLowerCase()))
                    .map(student => {
                      const check = studentBookChecks.find(
                        c => c.studentId === student.id && c.bookAssignmentId === currentAssignment.id
                      );
                      const currentStatus: BookCheckStatus = check?.status || 'visto_completo';

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3 text-center font-bold text-slate-400">
                            {String(student.rollNumber).padStart(2, '0')}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {student.name}
                          </td>
                          <td className="py-3 px-4">
                            {/* Fast Pill Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(['visto_completo', 'incompleto', 'nao_fez', 'atrasado', 'justificado'] as BookCheckStatus[]).map(st => {
                                const isSelected = check ? check.status === st : st === 'visto_completo';
                                const cfg = statusConfig[st];
                                const IconComponent = cfg.icon;

                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleSetStudentStatus(student.id, st)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                      isSelected
                                        ? `${cfg.badge} ring-2 ring-indigo-500/20 shadow-2xs`
                                        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <IconComponent className="w-3 h-3" />
                                    <span>{cfg.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {currentAssignment.maxScore && (
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max={currentAssignment.maxScore}
                                value={check?.score !== undefined && check?.score !== null ? check.score : ''}
                                onChange={(e) => handleSetStudentScore(student.id, e.target.value)}
                                placeholder="—"
                                className="w-16 px-2 py-1 text-xs text-center font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </td>
                          )}

                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={check?.notes || ''}
                              onChange={(e) => handleSetStudentNotes(student.id, e.target.value)}
                              placeholder="Adicionar recado / observação..."
                              className="w-full px-2.5 py-1 text-xs bg-slate-50/60 hover:bg-white border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Matrix View (All Students × All Assignments) */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Nº</th>
                  <th className="py-2.5 px-4 min-w-[200px] sticky left-12 bg-slate-50 z-10 border-r border-slate-200">Nome do Aluno</th>
                  <th className="py-2.5 px-3 text-center w-28 border-r border-slate-200">Progresso</th>
                  {classAssignments.map(a => (
                    <th key={a.id} className="py-2.5 px-3 min-w-[140px] text-center border-r border-slate-200">
                      <div className="font-bold text-slate-800 truncate" title={a.bookTitle}>{a.bookTitle}</div>
                      <div className="text-[10px] text-indigo-600 font-semibold truncate" title={a.unitOrChapter}>{a.unitOrChapter}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{a.pages}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeStudents
                  .filter(s => !searchStudent || s.name.toLowerCase().includes(searchStudent.toLowerCase()))
                  .map(student => {
                    let complete = 0;
                    classAssignments.forEach(a => {
                      const chk = studentBookChecks.find(c => c.studentId === student.id && c.bookAssignmentId === a.id);
                      if (chk?.status === 'visto_completo') complete++;
                    });
                    const progress = classAssignments.length > 0 ? Math.round((complete / classAssignments.length) * 100) : 0;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400 sticky left-0 bg-white border-r border-slate-100">
                          {String(student.rollNumber).padStart(2, '0')}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-800 sticky left-12 bg-white border-r border-slate-100">
                          {student.name}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  progress === 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 w-8 text-right">{progress}%</span>
                          </div>
                        </td>
                        {classAssignments.map(a => {
                          const check = studentBookChecks.find(c => c.studentId === student.id && c.bookAssignmentId === a.id);
                          const st: BookCheckStatus = check?.status || 'visto_completo';
                          const cfg = statusConfig[st];
                          const IconComp = cfg.icon;

                          return (
                            <td key={a.id} className="py-2 px-3 text-center border-r border-slate-100">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badge}`}
                                title={check?.notes ? `Obs: ${check.notes}` : cfg.label}
                              >
                                <IconComp className="w-2.5 h-2.5" />
                                <span>{cfg.label.split(' ')[0]}</span>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Assignment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <BookCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingAssignment ? 'Editar Atividade de Livro' : 'Nova Atividade de Correção de Livro'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {currentClass.name} • {getTermLabel(currentClass.termType, selectedTerm)}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              {/* Material / Book Title */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome do Material / Livro Didático *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Livro Didático de Matemática - PNLD"
                  value={formBookTitle}
                  onChange={(e) => setFormBookTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />

                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {[
                    'Livro Didático - PNLD',
                    'Caderno de Atividades',
                    'Livro Paradidático',
                    'Apostila do Aluno',
                    'Caderno de Exercícios'
                  ].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setFormBookTitle(chip)}
                      className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-md text-slate-600 border border-slate-200 transition cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit / Chapter and Pages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Capítulo / Unidade *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cap. 4 - Equações do 1º Grau"
                    value={formUnitChapter}
                    onChange={(e) => setFormUnitChapter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Páginas Solicitadas *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: págs. 45 a 52"
                    value={formPages}
                    onChange={(e) => setFormPages(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Data da Solicitação
                  </label>
                  <input
                    type="date"
                    required
                    value={formAssignedDate}
                    onChange={(e) => setFormAssignedDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Data da Correção / Visto *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900"
                  />
                </div>
              </div>

              {/* Automatic Term Detection Feedback */}
              <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-700">Etapa vinculada pela data: </span>
                      <strong className="text-indigo-700 font-bold">{formDateValidation.detectedTermLabel}</strong>
                      {formDateValidation.detectedPeriodRange && (
                        <span className="text-[11px] text-indigo-500 ml-1.5">({formDateValidation.detectedPeriodRange})</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-200/60 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Automático
                  </span>
                </div>
                {!formDateValidation.isExactMatch && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-md border border-amber-200 flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      A data da correção corresponde ao <strong>{formDateValidation.detectedTermLabel}</strong>. O visto será contabilizado neste período.
                    </span>
                  </p>
                )}
              </div>

              {/* Optional Score */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formHasScore}
                    onChange={(e) => setFormHasScore(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Atribuir pontuação ou nota máxima a este visto</span>
                </label>

                {formHasScore && (
                  <div className="mt-2 pl-6">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      Pontuação Máxima (ex: 2.0 pts extras ou 10.0)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="100"
                      value={formMaxScore}
                      onChange={(e) => setFormMaxScore(Number(e.target.value))}
                      className="w-32 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Description / Instructions */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Orientações para os Alunos / Exercícios Específicos
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Resolver exercícios ímpares do 1 ao 15 com resolução no caderno..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
                >
                  {editingAssignment ? 'Salvar Alterações' : 'Cadastrar Atividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {assignmentToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Excluir Atividade de Livro"
          message={`Tem certeza que deseja excluir o controle de correção "${assignmentToDelete.bookTitle} - ${assignmentToDelete.unitOrChapter}"? Todos os vistos registrados nesta atividade serão removidos.`}
          confirmLabel="Sim, Excluir"
          cancelLabel="Cancelar"
          isDestructive={true}
          onConfirm={() => {
            onDeleteAssignment(assignmentToDelete.id);
            setAssignmentToDelete(null);
          }}
          onCancel={() => setAssignmentToDelete(null)}
        />
      )}
    </div>
  );
};
