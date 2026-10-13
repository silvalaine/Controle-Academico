import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Edit2,
  Layers,
  BookOpen,
  Clock,
  Award,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { AcademicYear, ClassRoom, TermType, AnnualRecoveryFormula } from '../types';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classRoom: ClassRoom | null;
  academicYears: AcademicYear[];
  onSave: (updatedClass: ClassRoom) => void;
}

export const EditClassModal: React.FC<EditClassModalProps> = ({
  isOpen,
  onClose,
  classRoom,
  academicYears,
  onSave
}) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [shift, setShift] = useState<'Matutino' | 'Vespertino' | 'Noturno' | 'Integral'>('Matutino');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termType, setTermType] = useState<TermType>('bimestral');
  const [passingGrade, setPassingGrade] = useState(6.0);
  const [passingRecoveryGrade, setPassingRecoveryGrade] = useState(5.0);
  const [annualRecoveryFormula, setAnnualRecoveryFormula] = useState<AnnualRecoveryFormula>('rec_final_direta');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (classRoom) {
      setName(classRoom.name || '');
      setSubject(classRoom.subject || '');
      setGradeLevel(classRoom.gradeLevel || 'Ensino Fundamental');
      setShift(classRoom.shift || 'Matutino');
      setAcademicYearId(classRoom.academicYearId || academicYears[0]?.id || 'year-2026');
      setTermType(classRoom.termType || 'bimestral');
      setPassingGrade(typeof classRoom.passingGrade === 'number' ? classRoom.passingGrade : 6.0);
      setPassingRecoveryGrade(typeof classRoom.passingRecoveryGrade === 'number' ? classRoom.passingRecoveryGrade : 5.0);
      setAnnualRecoveryFormula(classRoom.annualRecoveryFormula || 'rec_final_direta');
      setError(null);
    }
  }, [classRoom, academicYears]);

  if (!isOpen || !classRoom) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome da turma.');
      return;
    }
    if (!subject.trim()) {
      setError('Por favor, informe a disciplina da turma.');
      return;
    }

    const updated: ClassRoom = {
      ...classRoom,
      name: name.trim(),
      subject: subject.trim(),
      gradeLevel: gradeLevel.trim() || 'Ensino Fundamental',
      shift,
      academicYearId: academicYearId || classRoom.academicYearId,
      termType,
      passingGrade: Number(passingGrade) || 6.0,
      passingRecoveryGrade: Number(passingRecoveryGrade) || 5.0,
      maxGrade: 10.0,
      annualRecoveryFormula
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Edit2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Editar Turma
                </h2>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
                  {classRoom.name}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Altere o nome, disciplina, turno ou critérios de avaliação da turma
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Nome da Turma */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Nome da Turma *</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: 9º Ano A, 1º EM B, Módulo II"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
              />
            </div>

            {/* Disciplina */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Disciplina *</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Matemática, Robótica, Geral"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
              />
            </div>

            {/* Nível / Etapa */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <span>Nível / Etapa de Ensino</span>
              </label>
              <input
                type="text"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="Ex: Ensino Fundamental II"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>

            {/* Turno */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Turno</span>
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
              >
                <option value="Matutino">Matutino</option>
                <option value="Vespertino">Vespertino</option>
                <option value="Noturno">Noturno</option>
                <option value="Integral">Integral</option>
              </select>
            </div>

            {/* Ano Letivo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ano Letivo</span>
              </label>
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.title} {y.isActive ? '(Ativo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Modelo de Período Letivo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Modelo de Período *
              </label>
              <select
                value={termType}
                onChange={(e) => setTermType(e.target.value as TermType)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
              >
                <option value="bimestral">Bimestral (4 Bimestres)</option>
                <option value="trimestral">Trimestral (3 Trimestres)</option>
              </select>
            </div>

            {/* Média de Aprovação */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Média de Aprovação</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={passingGrade}
                onChange={(e) => setPassingGrade(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
              />
            </div>

            {/* Média Mínima para Recuperação */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nota Mín. da Rec. Final
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={passingRecoveryGrade}
                onChange={(e) => setPassingRecoveryGrade(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
              />
            </div>

            {/* Fórmula de Recuperação Final */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fórmula de Recuperação Final
              </label>
              <select
                value={annualRecoveryFormula}
                onChange={(e) => setAnnualRecoveryFormula(e.target.value as AnnualRecoveryFormula)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value="rec_final_direta">Repetir Nota da Rec. Final (Padrão)</option>
                <option value="substituicao">Substituição se Maior: max(Anual, Rec)</option>
                <option value="media_aritmetica">Média Aritmética: (Anual + Rec) ÷ 2</option>
                <option value="media_ponderada">Média Ponderada: (Anual × 6 + Rec × 4) ÷ 10</option>
                <option value="substitui_menor_bimestre">Substituição da Menor Nota Bimestral</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
