import React, { useState } from 'react';
import {
  Printer,
  FileDown,
  Calendar,
  BookOpen,
  CheckSquare,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import {
  ClassRoom,
  Student,
  AttendanceRecord,
  LessonContent
} from '../types';
import { getTermLabel, getTermCount } from '../utils/calculations';
import { generateClassDiaryAttendanceAndLessonsPDF } from '../utils/pdfGenerator';

interface ClassDiaryReportProps {
  currentClass: ClassRoom;
  students: Student[];
  attendances: AttendanceRecord[];
  lessons: LessonContent[];
  selectedTerm: number;
  teacherName?: string;
  onTermChange?: (term: number) => void;
}

export const ClassDiaryReport: React.FC<ClassDiaryReportProps> = ({
  currentClass,
  students,
  attendances,
  lessons,
  selectedTerm: initialTerm,
  teacherName: initialTeacherName,
  onTermChange
}) => {
  const [selectedTerm, setSelectedTerm] = useState<number>(initialTerm || 1);
  const [showAttendanceTable, setShowAttendanceTable] = useState<boolean>(true);
  const [showLessonsTable, setShowLessonsTable] = useState<boolean>(true);
  const [showSignatures, setShowSignatures] = useState<boolean>(true);

  const [schoolName, setSchoolName] = useState<string>(() => {
    try {
      return localStorage.getItem('diario_school_name') || 'Escola Municipal de Ensino';
    } catch (_) {
      return 'Escola Municipal de Ensino';
    }
  });

  const [teacherName, setTeacherName] = useState<string>(
    initialTeacherName || 'Professor(a) Responsável'
  );

  const handleSchoolNameChange = (val: string) => {
    setSchoolName(val);
    try {
      localStorage.setItem('diario_school_name', val);
    } catch (_) {}
  };

  const numTerms = getTermCount(currentClass.termType);
  const termLabel = selectedTerm === 0
    ? 'Consolidado Anual (Geral)'
    : getTermLabel(currentClass.termType, selectedTerm);

  // Filter lessons for this class and period
  const classLessons = lessons
    .filter(l => l.classId === currentClass.id && (selectedTerm === 0 || l.term === selectedTerm))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Filter attendances for this class and period
  const classAttendances = attendances.filter(
    a => a.classId === currentClass.id && (selectedTerm === 0 || a.term === selectedTerm)
  );

  // Distinct dates from lessons and attendance
  const attendanceDates = Array.from(new Set(classAttendances.map(a => a.date)));
  const distinctDates = Array.from(new Set([...classLessons.map(l => l.date), ...attendanceDates])).sort();

  // Active students
  const activeStudents = students
    .filter(s => s.classId === currentClass.id && s.status === 'active')
    .sort((a, b) => a.rollNumber - b.rollNumber);

  // Distinct calculation: Aulas Dadas (ministradas) vs Aulas Planejadas (previstas)
  const totalLessonsTaught = classLessons
    .filter(l => (l.status || 'dado') === 'dado')
    .reduce((acc, l) => acc + (l.lessonCount || 1), 0);

  const totalLessonsPlanned = classLessons
    .filter(l => l.status === 'previsto')
    .reduce((acc, l) => acc + (l.lessonCount || 1), 0);

  const totalClassesRecorded = totalLessonsTaught + totalLessonsPlanned;

  // Calculations for attendance grid
  const studentAttendanceStats = activeStudents.map(student => {
    const studentRecords = classAttendances.filter(a => a.studentId === student.id);
    const totalPossible = distinctDates.length || 1;
    let absences = 0;
    let justified = 0;

    const dateMap: Record<string, 'P' | 'F' | 'J' | '—'> = {};

    distinctDates.forEach(d => {
      const rec = studentRecords.find(a => a.date === d);
      if (!rec) {
        dateMap[d] = '—';
      } else if (rec.status === 'present') {
        dateMap[d] = 'P';
      } else if (rec.status === 'absent') {
        absences++;
        dateMap[d] = 'F';
      } else {
        justified++;
        dateMap[d] = 'J';
      }
    });

    const attendanceRate = Math.max(0, Math.round(((totalPossible - absences) / totalPossible) * 100));

    return {
      student,
      dateMap,
      absences,
      justified,
      attendanceRate,
      isAlert: attendanceRate < 75
    };
  });

  const overallClassAttendance = studentAttendanceStats.length > 0
    ? Math.round(
        studentAttendanceStats.reduce((acc, s) => acc + s.attendanceRate, 0) /
          studentAttendanceStats.length
      )
    : 100;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    generateClassDiaryAttendanceAndLessonsPDF(
      currentClass,
      students,
      attendances,
      lessons,
      {
        schoolName: schoolName.trim() || undefined,
        selectedTerm,
        teacherName: teacherName.trim() || undefined
      }
    );
  };

  const handleSelectTerm = (t: number) => {
    setSelectedTerm(t);
    if (onTermChange) {
      onTermChange(t);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration & Controls Card (Hidden in print) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-indigo-600" />
                Diário Oficial: Chamada & Conteúdos
              </h2>
              <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full">
                {currentClass.name} • {termLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Modelo oficial timbrado reunindo a folha de chamada com presença dia a dia e o registro detalhado dos conteúdos lançados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Download PDF button */}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
              title="Baixar arquivo PDF timbrado para imprimir ou arquivar"
            >
              <FileDown className="w-4 h-4 text-rose-600" />
              <span>Baixar PDF</span>
            </button>

            {/* Print button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              title="Imprimir relatório direto na impressora física via diálogo do navegador"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Diário</span>
            </button>
          </div>
        </div>

        {/* Filters and Metadata Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Period / Term Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Período Letivo:
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => handleSelectTerm(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {Array.from({ length: numTerms }).map((_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {getTermLabel(currentClass.termType, idx + 1)}
                </option>
              ))}
              <option value={0}>Consolidado Anual (Todas as aulas)</option>
            </select>
          </div>

          {/* School Name Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nome da Escola / Instituição:
            </label>
            <input
              type="text"
              placeholder="Ex: Escola Municipal Professora..."
              value={schoolName}
              onChange={(e) => handleSchoolNameChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Teacher Name Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Professor(a) Responsável:
            </label>
            <input
              type="text"
              placeholder="Nome do docente..."
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Quick Stats Summary */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] text-emerald-700 block font-bold uppercase">Aulas Dadas</span>
              <span className="font-extrabold text-emerald-900">{totalLessonsTaught}</span>
            </div>
            <div className="border-l border-slate-200 pl-2.5">
              <span className="text-[10px] text-amber-700 block font-bold uppercase">Planejadas</span>
              <span className="font-bold text-amber-900">{totalLessonsPlanned}</span>
            </div>
            <div className="border-l border-slate-200 pl-2.5">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Freq. Média</span>
              <span className="font-bold text-indigo-700">{overallClassAttendance}%</span>
            </div>
            <div className="border-l border-slate-200 pl-2.5">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Alunos</span>
              <span className="font-bold text-slate-800">{activeStudents.length}</span>
            </div>
          </div>
        </div>

        {/* Section Visibility Checkboxes */}
        <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-600 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAttendanceTable}
              onChange={(e) => setShowAttendanceTable(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium">1. Folha de Chamada (Presenças e Faltas dia a dia)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLessonsTable}
              onChange={(e) => setShowLessonsTable(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium">2. Diário de Conteúdos Ministrados</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSignatures}
              onChange={(e) => setShowSignatures(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium">3. Campos para Assinatura do Professor e Visto</span>
          </label>
        </div>
      </div>

      {/* Official Printable Sheet View (Clean white institutional design, NO black background) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:p-0 print:border-none print:shadow-none space-y-6">
        {/* Printable Official Header */}
        <div className="border-b-2 border-slate-300 pb-4">
          <div className="flex justify-between items-start">
            <div>
              {schoolName.trim() && (
                <div className="text-xs font-bold text-slate-600 tracking-wider uppercase mb-1">
                  {schoolName.trim()}
                </div>
              )}
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                DIÁRIO DE CLASSE OFICIAL — CHAMADA & CONTEÚDOS MINISTRADOS
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-700 font-medium">
                <span><strong>Turma:</strong> {currentClass.name}</span>
                <span>•</span>
                <span><strong>Disciplina:</strong> {currentClass.subject}</span>
                <span>•</span>
                <span><strong>Turno:</strong> {currentClass.shift}</span>
                <span>•</span>
                <span><strong>Período:</strong> {termLabel}</span>
                <span>•</span>
                <span><strong>Professor(a):</strong> {teacherName}</span>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 shrink-0">
              <span className="block font-bold text-slate-700">Total: {activeStudents.length} Alunos</span>
              <span className="block text-emerald-800 font-bold">Aulas Dadas (Ministradas): {totalLessonsTaught}</span>
              <span className="block text-amber-800 font-semibold">Aulas Planejadas: {totalLessonsPlanned}</span>
              <span className="block text-[11px]">Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* SECTION 1: ATTENDANCE & ROLL CALL (CHAMADA) */}
        {showAttendanceTable && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                1. Registro de Frequência e Chamada dos Alunos
              </h3>
              <div className="text-[11px] text-slate-500 flex items-center gap-3 print:hidden">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  P = Presente
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                  F = Falta
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
                  J = Justificada
                </span>
              </div>
            </div>

            {distinctDates.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center border border-slate-200 text-xs text-slate-500">
                Nenhuma aula ou chamada registrada para este período letivo ainda. Registre aulas na aba &ldquo;Conteúdos&rdquo; ou faça a chamada na aba &ldquo;Chamada&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-300">
                      <th className="py-2 px-2 text-center w-9 border-r border-slate-300">Nº</th>
                      <th className="py-2 px-2.5 w-24 border-r border-slate-300">Matrícula</th>
                      <th className="py-2 px-3 border-r border-slate-300 min-w-[180px]">Nome do Estudante</th>
                      {distinctDates.map((dateStr, idx) => {
                        const parts = dateStr.split('-');
                        const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
                        return (
                          <th
                            key={idx}
                            className="py-1 px-1 text-center border-r border-slate-300 w-9 text-[10px]"
                            title={`Data: ${dateStr}`}
                          >
                            <span className="font-bold text-slate-700 block">{shortDate}</span>
                            <span className="text-[9px] text-slate-400 block font-normal">{idx + 1}</span>
                          </th>
                        );
                      })}
                      <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Faltas</th>
                      <th className="py-2 px-2.5 text-center w-16 border-r border-slate-300">Freq. %</th>
                      <th className="py-2 px-2.5 text-center w-20">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {studentAttendanceStats.map(({ student, dateMap, absences, attendanceRate, isAlert }, sIdx) => (
                      <tr
                        key={student.id}
                        className={sIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40 print:bg-transparent'}
                      >
                        <td className="py-1.5 px-2 text-center font-bold text-slate-700 border-r border-slate-300">
                          {String(student.rollNumber).padStart(2, '0')}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px] text-slate-600 border-r border-slate-300">
                          {student.enrollmentNumber || '—'}
                        </td>
                        <td className="py-1.5 px-3 font-medium text-slate-900 border-r border-slate-300">
                          {student.name}
                        </td>
                        {distinctDates.map((d, dIdx) => {
                          const status = dateMap[d];
                          return (
                            <td
                              key={dIdx}
                              className={`py-1 px-1 text-center border-r border-slate-300 font-bold text-[10px] ${
                                status === 'P'
                                  ? 'text-emerald-700 bg-emerald-50/40 print:bg-transparent'
                                  : status === 'F'
                                  ? 'text-rose-700 bg-rose-50/70 print:bg-transparent'
                                  : status === 'J'
                                  ? 'text-sky-700 bg-sky-50/50 print:bg-transparent'
                                  : 'text-slate-300'
                              }`}
                            >
                              {status}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-300">
                          <span className={absences > 0 ? 'text-rose-700' : 'text-slate-600'}>
                            {absences}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-300">
                          <span className={isAlert ? 'text-rose-700 font-black' : 'text-slate-800'}>
                            {attendanceRate}%
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center text-[10px] font-semibold">
                          {isAlert ? (
                            <span className="text-rose-700 font-bold">Atenção</span>
                          ) : (
                            <span className="text-emerald-700">Regular</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 font-bold text-slate-800 text-[11px] border-t-2 border-slate-300 print:bg-transparent">
                      <td colSpan={3 + distinctDates.length} className="py-2 px-3 text-right border-r border-slate-300 uppercase tracking-wide">
                        Aulas Dadas (Ministradas): <span className="text-emerald-700 font-black">{totalLessonsTaught}</span> &nbsp;|&nbsp; Aulas Planejadas (Previstas): <span className="text-amber-700 font-black">{totalLessonsPlanned}</span>
                      </td>
                      <td className="py-2 px-2 text-center text-rose-700 font-bold border-r border-slate-300">
                        {studentAttendanceStats.reduce((sum, s) => sum + s.absences, 0)} Faltas
                      </td>
                      <td className="py-2 px-2 text-center text-indigo-700 font-bold border-r border-slate-300">
                        {overallClassAttendance}%
                      </td>
                      <td className="py-2 px-2 text-center text-[10px] text-emerald-700 font-bold">
                        {totalLessonsTaught} Dadas
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 1 FOOTER: STATISTICAL SUMMARY & SIGNATURES (PAGE 1 - FIM DA PÁGINA) */}
        {showAttendanceTable && (
          <div className="space-y-6 pt-4">
            {/* Statistical summary strip (Fim da página) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Turma & Componente</span>
                <p className="font-bold text-slate-800 mt-0.5">{currentClass.name} • {currentClass.subject}</p>
              </div>
              <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-bold uppercase block">Aulas Dadas (Ministradas)</span>
                <p className="font-extrabold text-emerald-950 text-base mt-0.5">{totalLessonsTaught} aulas dadas</p>
              </div>
              <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">Aulas Planejadas (Previstas)</span>
                <p className="font-extrabold text-amber-950 text-base mt-0.5">{totalLessonsPlanned} planejadas</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Frequência da Turma</span>
                <p className="font-bold text-indigo-700 mt-0.5">{overallClassAttendance}% de presença média</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Alunos Regulares</span>
                <p className="font-bold text-emerald-700 mt-0.5">
                  {studentAttendanceStats.filter(s => !s.isAlert).length} de {activeStudents.length} (&gt;= 75%)
                </p>
              </div>
            </div>

            {/* Page 1 Signatures */}
            {showSignatures && (
              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-12">
                <div className="text-center">
                  <div className="w-56 mx-auto border-b border-slate-400 mb-2"></div>
                  <p className="text-xs font-bold text-slate-800">{teacherName}</p>
                  <p className="text-[10px] text-slate-500">Professor(a) Responsável • Folha 1 (Chamada)</p>
                </div>
                <div className="text-center">
                  <div className="w-56 mx-auto border-b border-slate-400 mb-2"></div>
                  <p className="text-xs font-bold text-slate-800">Coordenação Pedagógica / Direção</p>
                  <p className="text-[10px] text-slate-500">Visto da Escola • Folha 1 (Chamada)</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: REGISTERED LESSONS CONTENT (STARTS ON PAGE 2)                 */}
        {/* ========================================================================= */}
        {showLessonsTable && (
          <div
            className="space-y-4 pt-10 border-t-4 border-slate-200 print:border-none print:pt-0 page-break-before"
            style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
          >
            {/* Visual Page 2 Banner in Screen View */}
            <div className="flex items-center justify-between print:hidden bg-slate-100/80 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-[11px] uppercase tracking-wide">
                  Página 2
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Item 2: Diário de Conteúdos Ministrados e Registro de Aulas
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Configurado para início na página 2 ao imprimir ou baixar em PDF
              </span>
            </div>

            {/* Page 2 Printable Official Header */}
            <div className="border-b-2 border-slate-300 pb-4 hidden print:block">
              <div className="flex justify-between items-start">
                <div>
                  {schoolName.trim() && (
                    <div className="text-xs font-bold text-slate-600 tracking-wider uppercase mb-1">
                      {schoolName.trim()}
                    </div>
                  )}
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                    DIÁRIO DE CLASSE OFICIAL — CONTEÚDOS MINISTRADOS (PÁGINA 2)
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-700 font-medium">
                    <span><strong>Turma:</strong> {currentClass.name}</span>
                    <span>•</span>
                    <span><strong>Disciplina:</strong> {currentClass.subject}</span>
                    <span>•</span>
                    <span><strong>Turno:</strong> {currentClass.shift}</span>
                    <span>•</span>
                    <span><strong>Período:</strong> {termLabel}</span>
                    <span>•</span>
                    <span><strong>Professor(a):</strong> {teacherName}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500 shrink-0">
                  <span className="block font-bold text-slate-700">Folha 2 de 2</span>
                  <span className="block text-emerald-800 font-bold">Aulas Dadas: {totalLessonsTaught}</span>
                  <span className="block text-amber-800 font-semibold">Aulas Planejadas: {totalLessonsPlanned}</span>
                  <span className="block text-[11px]">Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>

            {/* Section 2 Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                2. Diário de Conteúdos Ministrados e Registro de Aulas
              </h3>
              <div className="flex items-center gap-2 text-[11px] font-semibold print:hidden">
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  {totalLessonsTaught} Aulas Dadas (Ministradas)
                </span>
                <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                  {totalLessonsPlanned} Aulas Planejadas
                </span>
                <span className="text-slate-500 font-normal">
                  (Total: {classLessons.length} registros)
                </span>
              </div>
            </div>

            {classLessons.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center border border-slate-200 text-xs text-slate-500">
                Nenhum conteúdo curricular lançado para este período ainda. Acesse a aba &ldquo;Conteúdos&rdquo; para registrar as aulas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-300">
                      <th className="py-2 px-2.5 text-center w-14 border-r border-slate-300">Aula Nº</th>
                      <th className="py-2 px-3 text-center w-24 border-r border-slate-300">Data</th>
                      <th className="py-2 px-2.5 text-center w-16 border-r border-slate-300">Qtd.</th>
                      <th className="py-2 px-3 border-r border-slate-300 w-48">Objeto do Conhecimento</th>
                      <th className="py-2 px-3 border-r border-slate-300">Conteúdo Programático Desenvolvido</th>
                      <th className="py-2 px-3 border-r border-slate-300 w-28">BNCC</th>
                      <th className="py-2 px-3 border-r border-slate-300 w-36">Tarefa / Metodologia</th>
                      <th className="py-2 px-2.5 text-center w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {classLessons.map((lesson, lIdx) => {
                      const parts = lesson.date.split('-');
                      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : lesson.date;
                      return (
                        <tr
                          key={lesson.id}
                          className={lIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40 print:bg-transparent'}
                        >
                          <td className="py-2 px-2 text-center font-bold text-slate-700 border-r border-slate-300">
                            {lIdx + 1}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-700 border-r border-slate-300">
                            {formattedDate}
                          </td>
                          <td className="py-2 px-2.5 text-center font-semibold text-slate-700 border-r border-slate-300">
                            {lesson.lessonCount || 1} h/a
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-300">
                            {lesson.topic || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-700 border-r border-slate-300 whitespace-pre-line">
                            {lesson.contentDescription}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 border-r border-slate-300">
                            {lesson.bnccSkills || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600 border-r border-slate-300 text-[11px]">
                            {lesson.homework || 'Atividades em sala'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                lesson.status === 'dado'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {lesson.status === 'dado' ? 'Realizada' : 'Planejada'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 font-bold text-slate-800 text-[11px] border-t-2 border-slate-300 print:bg-transparent">
                      <td colSpan={2} className="py-2 px-3 text-center border-r border-slate-300">
                        {classLessons.length} Registros de Aulas
                      </td>
                      <td className="py-2 px-2.5 text-center font-black text-slate-900 border-r border-slate-300" title={`Aulas Dadas: ${totalLessonsTaught} | Planejadas: ${totalLessonsPlanned}`}>
                        <span className="text-emerald-800 font-bold block">{totalLessonsTaught} dadas</span>
                        {totalLessonsPlanned > 0 && (
                          <span className="text-amber-700 text-[10px] block font-normal">{totalLessonsPlanned} plan.</span>
                        )}
                      </td>
                      <td colSpan={4} className="py-2 px-3 border-r border-slate-300">
                        <span className="text-emerald-800 font-bold">Total de Aulas Dadas (Ministradas): {totalLessonsTaught}</span>
                        <span className="mx-2 text-slate-400">•</span>
                        <span className="text-amber-800 font-bold">Total de Aulas Planejadas (Previstas): {totalLessonsPlanned}</span>
                      </td>
                      <td className="py-2 px-2 text-center text-[10px] text-emerald-700 font-bold">
                        {totalLessonsTaught} Dadas
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Page 2 Signatures */}
            {showSignatures && (
              <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-2 gap-12">
                <div className="text-center">
                  <div className="w-56 mx-auto border-b border-slate-400 mb-2"></div>
                  <p className="text-xs font-bold text-slate-800">{teacherName}</p>
                  <p className="text-[10px] text-slate-500">Professor(a) Responsável • Folha 2 (Conteúdos)</p>
                </div>
                <div className="text-center">
                  <div className="w-56 mx-auto border-b border-slate-400 mb-2"></div>
                  <p className="text-xs font-bold text-slate-800">Coordenação Pedagógica / Direção</p>
                  <p className="text-[10px] text-slate-500">Visto da Escola • Folha 2 (Conteúdos)</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
