import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Calendar,
  Clock,
  Search,
  Trash2,
  Edit2,
  Tag,
  CheckCircle,
  CheckCircle2,
  FileText,
  ExternalLink,
  Link as LinkIcon,
  Filter,
  AlertCircle,
  Users,
  X,
  RotateCcw
} from 'lucide-react';
import { ClassRoom, LessonContent, LessonStatus } from '../types';
import {
  getTermLabel,
  validateDateInTerm,
  getTermForDate,
  formatPeriodRange
} from '../utils/calculations';
import { generateLessonDiaryPDF } from '../utils/pdfGenerator';
import { ConfirmModal } from './ConfirmModal';
import { SchoolLogoSelector } from './SchoolLogoSelector';
import {
  getSchoolLogo,
  getSchoolName,
  getIncludeSchoolLogoPreference,
  subscribeSchoolConfig
} from '../utils/schoolLogo';

interface LessonDiaryProps {
  currentClass: ClassRoom;
  classes?: ClassRoom[];
  lessons: LessonContent[];
  selectedTerm: number;
  onAddLesson: (newLesson: Omit<LessonContent, 'id'>) => void;
  onUpdateLesson: (lesson: LessonContent) => void;
  onDeleteLesson: (lessonId: string) => void;
  onSelectTerm?: (term: number) => void;
  onSelectClass?: (classId: string) => void;
}

export const LessonDiary: React.FC<LessonDiaryProps> = ({
  currentClass,
  classes,
  lessons,
  selectedTerm,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onSelectTerm,
  onSelectClass
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTermOnly, setFilterTermOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'dado' | 'previsto'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<LessonContent | null>(null);
  const [modalClassId, setModalClassId] = useState<string>(currentClass.id);
  const [keepFieldsOnSave, setKeepFieldsOnSave] = useState<boolean>(true);
  const [saveFeedback, setSaveFeedback] = useState<{
    className: string;
    termLabel: string;
    count: number;
    mode: 'create' | 'update';
  } | null>(null);
  const [savedClassesInSession, setSavedClassesInSession] = useState<string[]>([]);

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lessonCount, setLessonCount] = useState(2);
  const [topic, setTopic] = useState('');
  const [contentDescription, setContentDescription] = useState('');
  const [bnccSkills, setBnccSkills] = useState('');
  const [homework, setHomework] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [externalLinkTitle, setExternalLinkTitle] = useState('');
  const [status, setStatus] = useState<LessonStatus>('dado');

  // Filter lessons
  const allTermLessons = lessons
    .filter(l => l.classId === currentClass.id)
    .filter(l => !filterTermOnly || Number(l.term) === Number(selectedTerm));

  const classLessons = allTermLessons
    .filter(l => {
      if (statusFilter === 'all') return true;
      return (l.status || 'dado') === statusFilter;
    })
    .filter(l => {
      const q = searchQuery.toLowerCase();
      return (
        l.topic.toLowerCase().includes(q) ||
        l.contentDescription.toLowerCase().includes(q) ||
        (l.bnccSkills && l.bnccSkills.toLowerCase().includes(q)) ||
        (l.externalLinkTitle && l.externalLinkTitle.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalLessonsInView = allTermLessons.reduce((acc, curr) => acc + (Number(curr.lessonCount) || 1), 0);
  const givenLessonsInView = allTermLessons
    .filter(l => (l.status || 'dado') === 'dado')
    .reduce((acc, curr) => acc + (Number(curr.lessonCount) || 1), 0);
  const plannedLessonsInView = allTermLessons
    .filter(l => l.status === 'previsto')
    .reduce((acc, curr) => acc + (Number(curr.lessonCount) || 1), 0);

  const availableClasses = classes && classes.length > 0 ? classes : [currentClass];
  const modalClass = availableClasses.find(c => c.id === modalClassId) || currentClass;

  const handleOpenAdd = () => {
    setEditingLessonId(null);
    setModalClassId(currentClass.id);
    setSaveFeedback(null);
    setSavedClassesInSession([]);
    setDate(new Date().toISOString().split('T')[0]);
    setLessonCount(2);
    setTopic('');
    setContentDescription('');
    setBnccSkills('');
    setHomework('');
    setExternalLink('');
    setExternalLinkTitle('');
    setStatus('dado');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lesson: LessonContent) => {
    setEditingLessonId(lesson.id);
    setModalClassId(lesson.classId || currentClass.id);
    setSaveFeedback(null);
    setSavedClassesInSession([]);
    setDate(lesson.date);
    setLessonCount(lesson.lessonCount);
    setTopic(lesson.topic);
    setContentDescription(lesson.contentDescription);
    setBnccSkills(lesson.bnccSkills || '');
    setHomework(lesson.homework || '');
    setExternalLink(lesson.externalLink || '');
    setExternalLinkTitle(lesson.externalLinkTitle || '');
    setStatus(lesson.status || 'dado');
    setIsModalOpen(true);
  };

  const handleResetFormForNew = () => {
    setEditingLessonId(null);
    setTopic('');
    setContentDescription('');
    setBnccSkills('');
    setHomework('');
    setExternalLink('');
    setExternalLinkTitle('');
    setSaveFeedback(null);
  };

  const handleToggleStatus = (lesson: LessonContent) => {
    const nextStatus: LessonStatus = lesson.status === 'previsto' ? 'dado' : 'previsto';
    onUpdateLesson({
      ...lesson,
      status: nextStatus
    });
  };

  // Detect term corresponding to the date entered in the form using the selected modal class
  const dateValidation = validateDateInTerm(date, selectedTerm, modalClass);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !contentDescription.trim()) return;

    let formattedLink = externalLink.trim();
    if (formattedLink && !formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
      formattedLink = 'https://' + formattedLink;
    }

    const termToSave = dateValidation.detectedTerm;
    const targetClassId = modalClass.id;
    const isEditMode = Boolean(editingLessonId);

    if (editingLessonId) {
      onUpdateLesson({
        id: editingLessonId,
        classId: targetClassId,
        date,
        term: termToSave,
        lessonCount: Number(lessonCount) || 1,
        topic: topic.trim(),
        contentDescription: contentDescription.trim(),
        bnccSkills: bnccSkills.trim() || undefined,
        homework: homework.trim() || undefined,
        externalLink: formattedLink || undefined,
        externalLinkTitle: externalLinkTitle.trim() || undefined,
        status
      });
    } else {
      onAddLesson({
        classId: targetClassId,
        date,
        term: termToSave,
        lessonCount: Number(lessonCount) || 1,
        topic: topic.trim(),
        contentDescription: contentDescription.trim(),
        bnccSkills: bnccSkills.trim() || undefined,
        homework: homework.trim() || undefined,
        externalLink: formattedLink || undefined,
        externalLinkTitle: externalLinkTitle.trim() || undefined,
        status
      });
    }

    if (targetClassId !== currentClass.id && onSelectClass) {
      onSelectClass(targetClassId);
    }

    // If lesson was registered into another term (e.g. October -> 4º Bimestre), auto-switch term view
    if (termToSave !== selectedTerm && onSelectTerm) {
      onSelectTerm(termToSave);
    }

    setSavedClassesInSession(prev =>
      prev.includes(modalClass.name) ? prev : [...prev, modalClass.name]
    );
    setSaveFeedback(prev => ({
      className: modalClass.name,
      termLabel: dateValidation.detectedTermLabel,
      count: (prev?.count || 0) + 1,
      mode: isEditMode ? 'update' : 'create'
    }));

    if (!isEditMode && !keepFieldsOnSave) {
      setTopic('');
      setContentDescription('');
      setBnccSkills('');
      setHomework('');
      setExternalLink('');
      setExternalLinkTitle('');
    }
  };

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

  const handleExportPDF = () => {
    generateLessonDiaryPDF(currentClass, lessons, selectedTerm, {
      schoolName: schoolName.trim() || undefined,
      schoolLogo: includeLogo ? schoolLogo : null,
      includeLogo
    });
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              Diário de Conteúdos Ministrados
            </h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full">
              {currentClass.name} • {getTermLabel(currentClass.termType, selectedTerm)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro diário de temas, metodologia desenvolvida, habilidades da BNCC e materiais de apoio com links externos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stats Badges */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-lg text-slate-700 bg-white shadow-2xs">
              Total: <strong className="text-indigo-700">{totalLessonsInView}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-200/60" title="Aulas dadas/realizadas">
              Dadas: <strong>{givenLessonsInView}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg text-amber-800 bg-amber-50 border border-amber-200/60" title="Aulas previstas/planejadas">
              Previstas: <strong>{plannedLessonsInView}</strong>
            </span>
          </div>

          {/* School Logo Selector Option */}
          <SchoolLogoSelector
            compact
            includeLogo={includeLogo}
            onToggleIncludeLogo={setIncludeLogo}
            currentLogo={schoolLogo}
            onLogoChange={setSchoolLogoState}
            schoolName={schoolName}
            onSchoolNameChange={setSchoolName}
          />

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            title="Exportar Diário de Conteúdos Oficial em PDF"
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>Gerar PDF</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Aula</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por tema, conteúdo, BNCC ou link..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({allTermLessons.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('dado')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 ${
                statusFilter === 'dado'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Dadas ({allTermLessons.filter(l => (l.status || 'dado') === 'dado').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('previsto')}
              className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 ${
                statusFilter === 'previsto'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Previstas ({allTermLessons.filter(l => l.status === 'previsto').length})</span>
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-slate-600 text-xs cursor-pointer ml-auto sm:ml-2">
            <input
              type="checkbox"
              checked={filterTermOnly}
              onChange={(e) => setFilterTermOnly(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Apenas {getTermLabel(currentClass.termType, selectedTerm)}</span>
          </label>
        </div>
      </div>

      {/* Lesson List Cards */}
      {classLessons.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Nenhum registro de aula encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Utilize o botão &ldquo;Registrar Aula&rdquo; acima para adicionar os conteúdos e habilidades lecionados nesta turma.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {classLessons.map((lesson) => (
            <div
              key={lesson.id}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center shrink-0 border border-indigo-100 font-bold">
                    <span className="text-xs">{lesson.date.split('-')[2]}</span>
                    <span className="text-[9px] uppercase text-indigo-400">
                      {new Date(lesson.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {lesson.topic}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {lesson.date.split('-').reverse().join('/')}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {lesson.lessonCount} {lesson.lessonCount > 1 ? 'aulas geminadas' : 'aula'}
                      </span>
                      <span>•</span>
                      <span className="text-indigo-600 font-medium">
                        {getTermLabel(currentClass.termType, lesson.term)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-start">
                  {/* Status Toggle Button / Badge */}
                  <button
                    onClick={() => handleToggleStatus(lesson)}
                    title="Clique para alternar entre Previsto e Dado"
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer shadow-2xs ${
                      lesson.status === 'previsto'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                    }`}
                  >
                    {lesson.status === 'previsto' ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Previsto</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Dado</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(lesson)}
                    title="Editar registro"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLessonToDelete(lesson)}
                    title="Excluir registro"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-100 whitespace-pre-line">
                {lesson.contentDescription}
              </p>

              {/* BNCC, Homework and External Link */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {lesson.bnccSkills && (
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md font-medium text-[11px] border border-blue-200/60">
                      <Tag className="w-3 h-3 text-blue-500" />
                      <span>BNCC: {lesson.bnccSkills}</span>
                    </div>
                  )}

                  {lesson.homework && (
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md text-[11px] border border-amber-200/60">
                      <FileText className="w-3 h-3 text-amber-500" />
                      <span>Tarefa: {lesson.homework}</span>
                    </div>
                  )}

                  {/* External Link Option */}
                  {lesson.externalLink && (
                    <a
                      href={lesson.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[11px] font-bold border border-indigo-200 transition"
                      title={`Abrir recurso externo: ${lesson.externalLink}`}
                    >
                      <LinkIcon className="w-3 h-3 text-indigo-500" />
                      <span>{lesson.externalLinkTitle || 'Material de Apoio / Link'}</span>
                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                    </a>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  Diário registrado
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Lesson Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-0.5">
                  {editingLessonId ? 'Editar Registro de Aula' : 'Novo Registro de Aula Ministrada'}
                </h3>
                <p className="text-xs text-slate-500">
                  {modalClass.name} • {dateValidation.detectedTermLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Fechar janela"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seletor de Turma dentro da janela */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Turma do Registro *</span>
                  </label>
                  {availableClasses.length > 1 && (
                    <span className="text-[11px] text-slate-500">
                      Troque de turma sem fechar
                    </span>
                  )}
                </div>
                <select
                  value={modalClass.id}
                  onChange={(e) => {
                    const nextClassId = e.target.value;
                    setModalClassId(nextClassId);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}{cls.subject ? ` — ${cls.subject}` : ''}
                    </option>
                  ))}
                </select>
                {savedClassesInSession.length > 0 && (
                  <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Salvo nesta janela em: <strong>{savedClassesInSession.join(', ')}</strong>
                    </span>
                  </p>
                )}
              </div>

              {/* Opção Previsto ou Dado */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Situação / Status da Aula *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('dado')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      status === 'dado'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Dado (Ministrada)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('previsto')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      status === 'previsto'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Previsto (Planejada)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Data da Aula *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Qtd. de Aulas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={lessonCount}
                    onChange={(e) => setLessonCount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                {/* Automatic Term Detection Feedback */}
                <div className="col-span-2 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-700">Etapa vinculada pela data: </span>
                        <strong className="text-indigo-700 font-bold">{dateValidation.detectedTermLabel}</strong>
                        {dateValidation.detectedPeriodRange && (
                          <span className="text-[11px] text-indigo-500 ml-1.5">({dateValidation.detectedPeriodRange})</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-200/60 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Automático
                    </span>
                  </div>
                  {!dateValidation.isExactMatch && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-md border border-amber-200 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        A data informada pertence ao <strong>{dateValidation.detectedTermLabel}</strong>. O diário será registrado e organizado automaticamente nesta etapa.
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tema / Assunto Principal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Teorema de Pitágoras e Aplicações"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Descrição do Conteúdo & Metodologia *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detalhe o que foi abordado, exercícios trabalhados, debates ou atividades desenvolvidas..."
                  value={contentDescription}
                  onChange={(e) => setContentDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Habilidades BNCC
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: EF09MA01, EF09MA02"
                    value={bnccSkills}
                    onChange={(e) => setBnccSkills(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Lição de Casa / Tarefas
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Livro didático pág. 45"
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* External Link Fields */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-indigo-900 block mb-2 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                  Link Externo / Material de Apoio Digital (Opcional)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      URL / Link do Material
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/... ou youtube.com/..."
                      value={externalLink}
                      onChange={(e) => setExternalLink(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Título ou Rótulo do Link
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Slides da Aula no Google Drive"
                      value={externalLinkTitle}
                      onChange={(e) => setExternalLinkTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {!editingLessonId && (
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={keepFieldsOnSave}
                    onChange={(e) => setKeepFieldsOnSave(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Manter campos preenchidos ao salvar (facilita lançar em outra turma)</span>
                </label>
              )}

              {saveFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {saveFeedback.mode === 'update'
                          ? `Alterações salvas em ${saveFeedback.className} (${saveFeedback.termLabel})!`
                          : `Aula registrada em ${saveFeedback.className} (${saveFeedback.termLabel})!`}
                      </p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Você continua na mesma janela: troque a turma acima para replicar, clique em &ldquo;Limpar Campos&rdquo; para uma nova aula ou em &ldquo;Fechar&rdquo;.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSaveFeedback(null)}
                    className="text-emerald-600 hover:text-emerald-900 p-0.5 cursor-pointer"
                    title="Ocultar aviso"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetFormForNew}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold rounded-lg transition cursor-pointer"
                  title="Limpar texto para lançar uma nova aula"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{editingLessonId ? 'Novo Registro (Limpar)' : 'Limpar Campos'}</span>
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-semibold rounded-lg transition cursor-pointer"
                  >
                    {saveFeedback ? 'Fechar' : 'Cancelar'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-lg shadow-xs transition cursor-pointer"
                  >
                    {editingLessonId ? 'Salvar Alterações' : 'Salvar Registro'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Lesson Deletion */}
      <ConfirmModal
        isOpen={!!lessonToDelete}
        title="Excluir Registro de Aula"
        message={`Tem certeza que deseja excluir o registro da aula "${lessonToDelete?.topic}" do dia ${lessonToDelete?.date}? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, Excluir Aula"
        onConfirm={() => {
          if (lessonToDelete) {
            onDeleteLesson(lessonToDelete.id);
            setLessonToDelete(null);
          }
        }}
        onCancel={() => setLessonToDelete(null)}
      />
    </div>
  );
};
