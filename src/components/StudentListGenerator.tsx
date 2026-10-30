import React, { useState } from 'react';
import {
  Printer,
  FileDown,
  Copy,
  Check,
  Users,
  Settings2,
  FileSpreadsheet,
  PenTool,
  Contact,
  BarChart,
  Search,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  X,
  Camera,
  UserCircle,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import {
  ClassRoom,
  Student,
  StudentStatus,
  Assessment,
  GradeRecord,
  AttendanceRecord
} from '../types';
import { generateStudentListPDF, generateCarodromoPDF } from '../utils/pdfGenerator';
import { compressStudentPhoto } from '../utils/imageCompressor';
import { calculateStudentAttendance, calculateStudentOverallAverage } from '../utils/calculations';
import { SchoolLogoSelector } from './SchoolLogoSelector';
import {
  getSchoolLogo,
  getSchoolName,
  getIncludeSchoolLogoPreference,
  subscribeSchoolConfig
} from '../utils/schoolLogo';

interface StudentListGeneratorProps {
  currentClass: ClassRoom;
  students: Student[];
  assessments: Assessment[];
  gradeRecords: GradeRecord[];
  attendances: AttendanceRecord[];
  selectedTerm: number;
  onUpdateStudent?: (student: Student) => void;
  onAddStudent?: (newStudent: Omit<Student, 'id'>) => void;
  onDeleteStudent?: (studentId: string) => void;
}

export type ListTemplateMode = 'chamada' | 'assinatura' | 'cadastral' | 'desempenho' | 'carodromo';

export const StudentListGenerator: React.FC<StudentListGeneratorProps> = ({
  currentClass,
  students,
  assessments,
  gradeRecords,
  attendances,
  selectedTerm,
  onUpdateStudent,
  onAddStudent,
  onDeleteStudent
}) => {
  const [templateMode, setTemplateMode] = useState<ListTemplateMode>('chamada');
  const [blankColumnsCount, setBlankColumnsCount] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'canceled' | 'transferred'>('active');
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'number' | 'name'>('number');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Add Student modal state & photo upload
  const [isAddingStudent, setIsAddingStudent] = useState<boolean>(false);
  const [stdName, setStdName] = useState<string>('');
  const [stdRoll, setStdRoll] = useState<number>(() => {
    const classStds = students.filter(s => s.classId === currentClass.id);
    return classStds.length > 0 ? Math.max(...classStds.map(s => s.rollNumber)) + 1 : 1;
  });
  const [stdEnrollment, setStdEnrollment] = useState<string>('');
  const [stdGuardian, setStdGuardian] = useState<string>('');
  const [stdPhone, setStdPhone] = useState<string>('');
  const [stdStatus, setStdStatus] = useState<StudentStatus>('active');
  const [stdPhotoUrl, setStdPhotoUrl] = useState<string>('');
  const [isPhotoLoading, setIsPhotoLoading] = useState<boolean>(false);
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);

  const [schoolName, setSchoolName] = useState<string>(() => {
    return getSchoolName();
  });

  const [includeLogo, setIncludeLogo] = useState<boolean>(() => getIncludeSchoolLogoPreference());
  const [schoolLogo, setSchoolLogoState] = useState<string | null>(() => getSchoolLogo());

  React.useEffect(() => {
    const unsub = subscribeSchoolConfig(() => {
      setIncludeLogo(getIncludeSchoolLogoPreference());
      setSchoolLogoState(getSchoolLogo());
      setSchoolName(getSchoolName());
    });
    return unsub;
  }, []);

  const handleSchoolNameChange = (val: string) => {
    setSchoolName(val);
    try {
      localStorage.setItem('diario_school_name', val);
    } catch (_) {}
  };

  // Filter students by class and status
  const classStudents = students
    .filter(s => s.classId === currentClass.id)
    .filter(s => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return s.status === 'active';
      if (statusFilter === 'canceled') return s.status === 'canceled';
      if (statusFilter === 'transferred') return s.status === 'transferred';
      return true;
    })
    .filter(s => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.enrollmentNumber && s.enrollmentNumber.toLowerCase().includes(q)) ||
        String(s.rollNumber).includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'pt-BR');
      }
      return a.rollNumber - b.rollNumber;
    });

  const activeCount = students.filter(s => s.classId === currentClass.id && s.status === 'active').length;
  const canceledCount = students.filter(s => s.classId === currentClass.id && s.status === 'canceled').length;
  const transferredCount = students.filter(s => s.classId === currentClass.id && s.status === 'transferred').length;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    if (templateMode === 'carodromo') {
      generateCarodromoPDF(currentClass, classStudents, {
        schoolName: schoolName.trim() || undefined,
        schoolLogo: includeLogo ? schoolLogo : null,
        includeLogo,
        customTitle: customTitle.trim() || undefined
      });
      return;
    }

    generateStudentListPDF(currentClass, classStudents, templateMode, {
      schoolName: schoolName.trim() || undefined,
      schoolLogo: includeLogo ? schoolLogo : null,
      includeLogo,
      customTitle: customTitle.trim() || undefined,
      blankColumnsCount,
      showSignatures,
      onlyActive: statusFilter === 'active'
    });
  };

  const handleCopyNames = () => {
    const text = classStudents
      .map(s => `${String(s.rollNumber).padStart(2, '0')}\t${s.name}\t${s.enrollmentNumber || ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStatusChange = (student: Student, newStatus: StudentStatus) => {
    if (onUpdateStudent) {
      onUpdateStudent({ ...student, status: newStatus });
      const label =
        newStatus === 'canceled'
          ? 'Cancelado (Saiu da escola)'
          : newStatus === 'transferred'
          ? 'Transferido'
          : newStatus === 'active'
          ? 'Ativo'
          : 'Inativo';
      setStatusFeedback(`Situação de "${student.name}" alterada para: ${label}`);
      setTimeout(() => setStatusFeedback(null), 4000);
    }
  };

  const handleQuickPhotoUpload = async (student: Student, file: File) => {
    try {
      setUploadingStudentId(student.id);
      const compressed = await compressStudentPhoto(file, 240, 0.82);
      if (onUpdateStudent) {
        onUpdateStudent({ ...student, photoUrl: compressed });
      }
      setStatusFeedback(`Foto de ${student.name} atualizada com sucesso!`);
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Falha ao processar a foto.');
    } finally {
      setUploadingStudentId(null);
    }
  };

  const handleNewStudentPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsPhotoLoading(true);
      const compressed = await compressStudentPhoto(file, 240, 0.82);
      setStdPhotoUrl(compressed);
    } catch (err: any) {
      alert(err?.message || 'Falha ao processar a foto.');
    } finally {
      setIsPhotoLoading(false);
      e.target.value = '';
    }
  };

  const handleOpenAddStudent = () => {
    const classStds = students.filter(s => s.classId === currentClass.id);
    const nextRoll = classStds.length > 0 ? Math.max(...classStds.map(s => s.rollNumber)) + 1 : 1;
    setStdName('');
    setStdRoll(nextRoll);
    setStdEnrollment('');
    setStdGuardian('');
    setStdPhone('');
    setStdStatus('active');
    setStdPhotoUrl('');
    setIsAddingStudent(true);
  };

  const handleSaveNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stdName.trim()) return;
    if (onAddStudent) {
      onAddStudent({
        classId: currentClass.id,
        rollNumber: stdRoll,
        name: stdName.trim(),
        enrollmentNumber: stdEnrollment.trim() || `MAT-${Date.now().toString().slice(-4)}`,
        guardianName: stdGuardian.trim() || undefined,
        guardianPhone: stdPhone.trim() || undefined,
        status: stdStatus,
        photoUrl: stdPhotoUrl || undefined
      });
      setStatusFeedback(`Aluno "${stdName.trim()}" cadastrado com sucesso!`);
      setTimeout(() => setStatusFeedback(null), 4000);
      setIsAddingStudent(false);
    }
  };

  const defaultTitles: Record<ListTemplateMode, string> = {
    chamada: `Lista de Chamada Diária — ${currentClass.name}`,
    assinatura: `Comprovante de Assinatura & Entrega — ${currentClass.name}`,
    cadastral: `Ficha Cadastral e Contatos dos Responsáveis — ${currentClass.name}`,
    desempenho: `Relação da Turma com Frequência & Médias — ${currentClass.name}`,
    carodromo: `Caródromo dos Alunos — ${currentClass.name}`
  };

  const effectiveTitle = customTitle.trim() || defaultTitles[templateMode];

  return (
    <div className="space-y-6">
      {/* Top Controls Bar (hidden during print) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Lista de Alunos da Turma
            </h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full">
              {currentClass.name} • {currentClass.shift}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gere, visualize e imprima listas oficiais personalizadas da turma para chamada diária, reuniões ou assinaturas. Altere a situação para &ldquo;Cancelado&rdquo; quando o aluno sair da escola.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Student Button (if onAddStudent provided) */}
          {onAddStudent && (
            <button
              onClick={handleOpenAddStudent}
              title="Cadastrar novo estudante nesta turma"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo Aluno</span>
            </button>
          )}

          {/* Copy Names Button */}
          <button
            onClick={handleCopyNames}
            title="Copiar lista de alunos formatada para o Excel ou Word"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copiar Nomes</span>
              </>
            )}
          </button>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            title="Gerar e baixar arquivo PDF oficial da lista"
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition shadow-xs"
          >
            <FileDown className="w-4 h-4 text-rose-600" />
            <span>Baixar PDF</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            title="Imprimir lista de alunos formatada para folha A4"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Lista</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {statusFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-xl font-medium flex items-center justify-between shadow-2xs print:hidden animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusFeedback}</span>
          </div>
          <button
            onClick={() => setStatusFeedback(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold p-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal Adicionar Aluno */}
      {isAddingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs print:hidden">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl max-w-lg w-full space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Cadastrar Novo Aluno na Turma
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingStudent(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewStudent} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nome Completo do Aluno *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ana Carolina Silva"
                    value={stdName}
                    onChange={(e) => setStdName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nº de Chamada *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={stdRoll}
                    onChange={(e) => setStdRoll(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Matrícula (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2026-9A-042"
                    value={stdEnrollment}
                    onChange={(e) => setStdEnrollment(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Situação / Status Inicial
                  </label>
                  <select
                    value={stdStatus}
                    onChange={(e) => setStdStatus(e.target.value as StudentStatus)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    <option value="active">Ativo (Frequentando)</option>
                    <option value="canceled">Cancelado (Saiu da escola / Matrícula cancelada)</option>
                    <option value="transferred">Transferido (Mudou de turma/escola)</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nome do Responsável
                  </label>
                  <input
                    type="text"
                    placeholder="Mãe, pai ou responsável legal"
                    value={stdGuardian}
                    onChange={(e) => setStdGuardian(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Telefone de Contato / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(XX) 9XXXX-XXXX"
                    value={stdPhone}
                    onChange={(e) => setStdPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Foto do Aluno */}
              <div className="flex items-center gap-3.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="w-14 h-14 rounded-xl border border-slate-300 flex items-center justify-center overflow-hidden bg-white shrink-0 relative">
                  {stdPhotoUrl ? (
                    <img src={stdPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-8 h-8 text-slate-300" />
                  )}
                  {isPhotoLoading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-indigo-600">Ajustando...</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-slate-800 block">Foto do Aluno (Caródromo)</span>
                  <span className="text-[11px] text-slate-500 block mb-1">Insira uma foto para o caródromo da turma.</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 text-xs font-semibold rounded-lg border border-slate-300 cursor-pointer transition">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{stdPhotoUrl ? 'Trocar' : 'Carregar Foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleNewStudentPhotoSelected}
                        className="hidden"
                        disabled={isPhotoLoading}
                      />
                    </label>
                    {stdPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setStdPhotoUrl('')}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-1.5 py-1"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingStudent(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Salvar Aluno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configuration & Options Card (hidden during print) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 print:hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
            <Settings2 className="w-4 h-4 text-indigo-600" />
            Modelo da Lista & Configurações
          </span>
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              {activeCount} Ativos
            </span>
            {canceledCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                {canceledCount} Cancelados (Saída)
              </span>
            )}
            {transferredCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                {transferredCount} Transferidos
              </span>
            )}
          </div>
        </div>

        {/* Template Selector Tabs */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-2">
            Selecione o Modelo da Lista:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => setTemplateMode('chamada')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                templateMode === 'chamada'
                  ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <FileSpreadsheet className={`w-5 h-5 shrink-0 mt-0.5 ${templateMode === 'chamada' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div>
                <span className="block text-xs font-bold">Chamada em Branco</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Colunas de datas para marcar presença à mão.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTemplateMode('assinatura')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                templateMode === 'assinatura'
                  ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <PenTool className={`w-5 h-5 shrink-0 mt-0.5 ${templateMode === 'assinatura' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div>
                <span className="block text-xs font-bold">Lista de Assinatura</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Espaço com linha para rubrica/assinatura.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTemplateMode('cadastral')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                templateMode === 'cadastral'
                  ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <Contact className={`w-5 h-5 shrink-0 mt-0.5 ${templateMode === 'cadastral' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div>
                <span className="block text-xs font-bold">Ficha de Contatos</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Matrícula, responsável e telefone celular.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTemplateMode('desempenho')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                templateMode === 'desempenho'
                  ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <BarChart className={`w-5 h-5 shrink-0 mt-0.5 ${templateMode === 'desempenho' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div>
                <span className="block text-xs font-bold">Resumo & Frequência</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Frequência % acumulada e médias.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTemplateMode('carodromo')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                templateMode === 'carodromo'
                  ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <Camera className={`w-5 h-5 shrink-0 mt-0.5 ${templateMode === 'carodromo' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div>
                <span className="block text-xs font-bold">Caródromo da Turma</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Mural com fotos, nomes e matrículas.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Customization Options Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* School Name Input */}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nome da Escola / Instituição de Ensino:
            </label>
            <input
              type="text"
              placeholder="Ex: Escola Municipal Professora Maria..."
              value={schoolName}
              onChange={(e) => handleSchoolNameChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Custom Title Input */}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Título Personalizado da Lista (Opcional):
            </label>
            <input
              type="text"
              placeholder={defaultTitles[templateMode]}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Blank Columns Count for Chamada */}
          {templateMode === 'chamada' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Colunas de Chamada (Dias):
              </label>
              <select
                value={blankColumnsCount}
                onChange={(e) => setBlankColumnsCount(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={5}>5 dias (1 semana)</option>
                <option value={10}>10 dias (2 semanas)</option>
                <option value={15}>15 dias (3 semanas)</option>
                <option value={20}>20 dias (1 mês letivo)</option>
              </select>
            </div>
          )}

          {/* Sort By */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Ordenação:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'number' | 'name')}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="number">Por Número de Chamada (1, 2, 3...)</option>
              <option value="name">Por Ordem Alfabética (A-Z)</option>
            </select>
          </div>

          {/* Search filter */}
          <div className={templateMode === 'chamada' ? 'sm:col-span-2' : 'sm:col-span-3'}>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Buscar Aluno na Lista:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Filter and Toggles Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700">Situação:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Apenas Ativos ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({students.filter(s => s.classId === currentClass.id).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('canceled')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'canceled'
                    ? 'bg-white text-rose-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Estudantes que saíram da escola com matrícula cancelada"
              >
                Cancelados / Saída ({canceledCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('transferred')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'transferred'
                    ? 'bg-white text-amber-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Transferidos ({transferredCount})
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-slate-600">
            <input
              type="checkbox"
              checked={showSignatures}
              onChange={(e) => setShowSignatures(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium">Exibir campo para assinatura do professor e visto da coordenação</span>
          </label>
        </div>

        {/* School Logo Selector Card */}
        <SchoolLogoSelector
          includeLogo={includeLogo}
          onToggleIncludeLogo={setIncludeLogo}
          currentLogo={schoolLogo}
          onLogoChange={setSchoolLogoState}
          schoolName={schoolName}
          onSchoolNameChange={handleSchoolNameChange}
          showSchoolNameInput={false}
        />
      </div>

      {/* Printable Sheet View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:p-0 print:border-none print:shadow-none">
        {/* Printable Official Header (No black background, clean institutional typography) */}
        <div className="border-b-2 border-slate-300 pb-4 mb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-start gap-3.5">
              {includeLogo && schoolLogo && (
                <img
                  src={schoolLogo}
                  alt="Brasão da Escola"
                  className="w-14 h-14 object-contain rounded bg-white p-0.5 border border-slate-200 shrink-0 print:block"
                />
              )}
              <div>
                {schoolName.trim() && (
                  <div className="text-xs font-bold text-slate-600 tracking-wider uppercase mb-1">
                    {schoolName.trim()}
                  </div>
                )}
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                  {effectiveTitle}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-700 font-medium">
                  <span><strong>Turma:</strong> {currentClass.name}</span>
                  <span>•</span>
                  <span><strong>Disciplina:</strong> {currentClass.subject}</span>
                  <span>•</span>
                  <span><strong>Turno:</strong> {currentClass.shift}</span>
                  <span>•</span>
                  <span><strong>Segmento:</strong> {currentClass.gradeLevel}</span>
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 shrink-0">
              <span className="block font-bold text-slate-700">Total: {classStudents.length} Estudantes</span>
              <span className="block text-[11px]">Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* CARÓDROMO VIEW */}
        {templateMode === 'carodromo' ? (
          <div>
            <div className="mb-4 flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 print:hidden">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Caródromo da Turma:</strong> Identificação visual com fotos dos estudantes. Clique no botão de câmera em qualquer card para carregar ou alterar a foto. Ao clicar em <strong>Baixar PDF</strong>, as fotos serão organizadas em grade institucional de 16 alunos por folha.
                </span>
              </div>
            </div>

            {classStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-300">
                Nenhum estudante encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {classStudents.map((student) => (
                  <div
                    key={student.id}
                    className="relative bg-white rounded-xl border border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-sm p-3.5 flex flex-col items-center text-center transition group print:border-slate-300 print:shadow-none"
                  >
                    {/* Roll Number Badge */}
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black text-[11px] rounded-md border border-indigo-200">
                      Nº {String(student.rollNumber).padStart(2, '0')}
                    </div>

                    {/* Status Badge (if not active) */}
                    {student.status !== 'active' && (
                      <div className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        student.status === 'canceled'
                          ? 'bg-rose-100 text-rose-800'
                          : student.status === 'transferred'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {student.status === 'canceled' ? 'Cancelado' : student.status === 'transferred' ? 'Transferido' : 'Inativo'}
                      </div>
                    )}

                    {/* Photo Container */}
                    <div className="relative mt-5 mb-2.5 w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 border-2 border-indigo-100 shadow-2xs flex items-center justify-center group-hover:border-indigo-400 transition">
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={student.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-100 text-indigo-300">
                          <UserCircle className="w-14 h-14" />
                          <span className="text-[10px] font-bold text-indigo-400 mt-0.5">Sem foto</span>
                        </div>
                      )}

                      {/* Loading Overlay */}
                      {uploadingStudentId === student.id && (
                        <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center">
                          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[9px] font-bold text-indigo-700 mt-1">Salvando...</span>
                        </div>
                      )}

                      {/* Camera Button to Change/Upload Photo (hover desktop, print hidden) */}
                      {onUpdateStudent && (
                        <label
                          className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition print:hidden"
                          title="Clique para tirar ou carregar foto deste estudante"
                        >
                          <Camera className="w-6 h-6 mb-1 text-white drop-shadow" />
                          <span className="text-[10px] font-bold bg-black/50 px-2 py-0.5 rounded text-white">
                            {student.photoUrl ? 'Alterar' : 'Inserir Foto'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleQuickPhotoUpload(student, file);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Student Name */}
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-tight">
                      {student.name}
                    </h3>

                    {/* Student Enrollment / RA */}
                    <p className="text-[11px] font-mono text-slate-500 mt-1">
                      {student.enrollmentNumber ? `Matrícula: ${student.enrollmentNumber}` : '—'}
                    </p>

                    {/* Quick photo upload button for touch / direct click */}
                    {onUpdateStudent && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 w-full flex items-center justify-center print:hidden">
                        <label className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 px-2.5 py-1 rounded-lg cursor-pointer transition">
                          <Camera className="w-3 h-3" />
                          <span>{student.photoUrl ? 'Trocar Foto' : 'Inserir Foto'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleQuickPhotoUpload(student, file);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* The Table for Chamada, Assinatura, Cadastral, Desempenho */
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-2 px-2.5 text-center w-10 border-r border-slate-300">Nº</th>
                  <th className="py-2 px-3 w-28 border-r border-slate-300">Matrícula</th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[200px]">Nome Completo do Estudante</th>

                  {/* Chamada Template Columns */}
                  {templateMode === 'chamada' && (
                    Array.from({ length: blankColumnsCount }).map((_, idx) => (
                      <th
                        key={idx}
                        className="py-1 px-1.5 text-center w-11 border-r border-slate-300 font-normal text-[10px]"
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-slate-700">__/__</span>
                          <span className="text-slate-400 text-[9px]">{idx + 1}</span>
                        </div>
                      </th>
                    ))
                  )}

                  {/* Assinatura Template Columns */}
                  {templateMode === 'assinatura' && (
                    <>
                      <th className="py-2 px-3 text-center w-24 border-r border-slate-300">Data</th>
                      <th className="py-2 px-4 border-r border-slate-300">
                        Assinatura / Rubrica do Estudante ou Responsável
                      </th>
                    </>
                  )}

                  {/* Cadastral Template Columns */}
                  {templateMode === 'cadastral' && (
                    <>
                      <th className="py-2 px-3 border-r border-slate-300">Nome do Responsável</th>
                      <th className="py-2 px-3 border-r border-slate-300 w-36">Telefone de Contato</th>
                      <th className="py-2 px-3 text-center w-24 border-r border-slate-300">Situação</th>
                    </>
                  )}

                  {/* Desempenho Template Columns */}
                  {templateMode === 'desempenho' && (
                    <>
                      <th className="py-2 px-2.5 text-center w-24 border-r border-slate-300">Freq. (%)</th>
                      <th className="py-2 px-2.5 text-center w-24 border-r border-slate-300">Média Geral</th>
                      <th className="py-2 px-3 text-center w-28 border-r border-slate-300">Situação</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {classStudents.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="py-8 text-center text-slate-400 italic">
                      Nenhum estudante encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  classStudents.map((student, idx) => {
                    let attPercent = 100;
                    let studentSummary: any = null;

                    if (templateMode === 'desempenho') {
                      const att = calculateStudentAttendance(student.id, currentClass.id, attendances);
                      attPercent = att.attendanceRate;
                      studentSummary = calculateStudentOverallAverage(
                        student.id,
                        currentClass,
                        assessments,
                        gradeRecords
                      );
                    }

                    return (
                      <tr
                        key={student.id}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50 print:bg-transparent'}
                      >
                        <td className="py-2 px-2 text-center font-bold text-slate-700 border-r border-slate-300">
                          {String(student.rollNumber).padStart(2, '0')}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600 border-r border-slate-300">
                          {student.enrollmentNumber || '—'}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900 border-r border-slate-300">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-indigo-50 border border-slate-200 shrink-0 flex items-center justify-center">
                                {student.photoUrl ? (
                                  <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <UserCircle className="w-5 h-5 text-indigo-300" />
                                )}
                              </div>
                              <span className={student.status === 'canceled' ? 'line-through text-slate-400 font-normal' : ''}>
                                {student.name}
                              </span>
                              {student.status === 'canceled' && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  Cancelado (Saída da escola)
                                </span>
                              )}
                              {student.status === 'transferred' && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  Transferido
                                </span>
                              )}
                            </div>

                            {/* Quick Status Select on all list modes */}
                            {onUpdateStudent && (
                              <div className="print:hidden shrink-0">
                                <select
                                  value={student.status || 'active'}
                                  onChange={(e) => handleStatusChange(student, e.target.value as any)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none transition ${
                                    student.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                      : student.status === 'canceled'
                                      ? 'bg-rose-50 text-rose-800 border-rose-300 font-black hover:bg-rose-100'
                                      : student.status === 'transferred'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                                  }`}
                                  title="Alterar situação da matrícula do aluno (Ativo, Cancelado quando sair da escola, Transferido)"
                                >
                                  <option value="active">✓ Ativo</option>
                                  <option value="canceled">✖ Cancelado (Saiu da escola)</option>
                                  <option value="transferred">➜ Transferido</option>
                                  <option value="inactive">○ Inativo</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Chamada Empty Cells */}
                        {templateMode === 'chamada' && (
                          Array.from({ length: blankColumnsCount }).map((_, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-2 px-1 text-center border-r border-slate-300 h-8"
                            >
                              &nbsp;
                            </td>
                          ))
                        )}

                        {/* Assinatura Cells */}
                        {templateMode === 'assinatura' && (
                          <>
                            <td className="py-2 px-2 text-center border-r border-slate-300 text-slate-400">
                              ___/___/2026
                            </td>
                            <td className="py-2 px-4 border-r border-slate-300 h-9">
                              <div className="w-full border-b border-dotted border-slate-400 mt-4"></div>
                            </td>
                          </>
                        )}

                        {/* Cadastral Cells */}
                        {templateMode === 'cadastral' && (
                          <>
                            <td className="py-2 px-3 text-slate-700 border-r border-slate-300">
                              {student.guardianName || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono text-[11px] border-r border-slate-300">
                              {student.guardianPhone || '—'}
                            </td>
                            <td className="py-2 px-3 text-center border-r border-slate-300">
                              {onUpdateStudent ? (
                                <select
                                  value={student.status || 'active'}
                                  onChange={(e) => onUpdateStudent({ ...student, status: e.target.value as any })}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none print:hidden ${
                                    student.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : student.status === 'canceled'
                                      ? 'bg-rose-50 text-rose-800 border-rose-300 font-extrabold'
                                      : student.status === 'transferred'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : 'bg-slate-50 text-slate-700 border-slate-300'
                                  }`}
                                  title="Alterar situação da matrícula"
                                >
                                  <option value="active">Ativo</option>
                                  <option value="canceled">Cancelado (Saiu)</option>
                                  <option value="transferred">Transferido</option>
                                  <option value="inactive">Inativo</option>
                                </select>
                              ) : null}
                              <span className={onUpdateStudent ? 'hidden print:inline-block text-[10px] font-bold' : `inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                student.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : student.status === 'canceled'
                                  ? 'bg-rose-50 text-rose-800 font-extrabold'
                                  : student.status === 'transferred'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-slate-50 text-slate-700'
                              }`}>
                                {student.status === 'active' ? 'Ativo' :
                                 student.status === 'canceled' ? 'Cancelado' :
                                 student.status === 'transferred' ? 'Transferido' : 'Inativo'}
                              </span>
                            </td>
                          </>
                        )}

                        {/* Desempenho Cells */}
                        {templateMode === 'desempenho' && (
                          <>
                            <td className="py-2 px-2.5 text-center font-bold border-r border-slate-300">
                              <span className={attPercent < 75 ? 'text-rose-700 font-black' : 'text-slate-800'}>
                                {attPercent}%
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-center font-bold border-r border-slate-300 text-indigo-700">
                              {studentSummary?.definitiveAverage !== null
                                ? Number(studentSummary.definitiveAverage).toFixed(1)
                                : '—'}
                            </td>
                            <td className="py-2 px-3 text-center border-r border-slate-300">
                              <span className="text-[11px] font-semibold text-slate-700">
                                {studentSummary?.status === 'approved' ? 'Aprovado' :
                                 studentSummary?.status === 'recovery' ? 'Recuperação' :
                                 studentSummary?.status === 'failed' ? 'Reprovado' : 'Em curso'}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Printable Footer with Signatures */}
        {showSignatures && (
          <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-10">
            <div className="text-center">
              <div className="w-56 mx-auto border-b border-slate-500 mb-2"></div>
              <p className="text-xs font-bold text-slate-800">Professor(a) Responsável</p>
              <p className="text-[10px] text-slate-500">{currentClass.subject}</p>
            </div>
            <div className="text-center">
              <div className="w-56 mx-auto border-b border-slate-500 mb-2"></div>
              <p className="text-xs font-bold text-slate-800">Coordenação Pedagógica / Direção</p>
              <p className="text-[10px] text-slate-500">Visto da Escola</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
