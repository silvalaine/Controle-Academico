import React from 'react';
import { Calendar, RotateCcw, Clock, Info } from 'lucide-react';
import { TermPeriod, TermType } from '../types';
import { getTermLabel, getDefaultTermPeriods } from '../utils/calculations';

interface TermPeriodsEditorProps {
  termType: TermType;
  termPeriods: TermPeriod[];
  onChange: (periods: TermPeriod[]) => void;
  academicYearNumber?: number;
}

export const TermPeriodsEditor: React.FC<TermPeriodsEditorProps> = ({
  termType,
  termPeriods,
  onChange,
  academicYearNumber = new Date().getFullYear()
}) => {
  const termCount = termType === 'bimestral' ? 4 : 3;

  // Ensure termPeriods has an entry for each term (1..termCount)
  const currentPeriods: TermPeriod[] = React.useMemo(() => {
    const defaults = getDefaultTermPeriods(termType, academicYearNumber);
    const list: TermPeriod[] = [];
    for (let t = 1; t <= termCount; t++) {
      const existing = termPeriods.find(p => p.term === t);
      const def = defaults.find(d => d.term === t);
      list.push({
        term: t,
        startDate: existing?.startDate || def?.startDate || `${academicYearNumber}-02-01`,
        endDate: existing?.endDate || def?.endDate || `${academicYearNumber}-12-15`
      });
    }
    return list;
  }, [termType, termPeriods, termCount, academicYearNumber]);

  const handleDateChange = (termNumber: number, field: 'startDate' | 'endDate', value: string) => {
    const updated = currentPeriods.map(p => {
      if (p.term === termNumber) {
        return { ...p, [field]: value };
      }
      return p;
    });
    onChange(updated);
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultTermPeriods(termType, academicYearNumber);
    onChange(defaults);
  };

  const calculateDays = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return null;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Períodos Letivos: Início e Término dos {termType === 'bimestral' ? 'Bimestres' : 'Trimestres'}</span>
          </h5>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Configure as datas de início e fim de cada {termType === 'bimestral' ? 'bimestre' : 'trimestre'} para esta turma.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs transition cursor-pointer self-start sm:self-auto"
          title="Preencher com o calendário escolar padrão"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Sugerir Datas Padrão</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {currentPeriods.map((period) => {
          const totalDays = calculateDays(period.startDate, period.endDate);
          const isInvalidRange = period.startDate && period.endDate && period.startDate > period.endDate;

          return (
            <div
              key={period.term}
              className={`p-3 rounded-xl border transition ${
                isInvalidRange
                  ? 'bg-rose-50/70 border-rose-300'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  {getTermLabel(termType, period.term)}
                </span>
                {totalDays !== null && !isInvalidRange && (
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                    {totalDays} dias corridos
                  </span>
                )}
                {isInvalidRange && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                    Data de término anterior ao início
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    required
                    value={period.startDate}
                    onChange={(e) => handleDateChange(period.term, 'startDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Data de Término
                  </label>
                  <input
                    type="date"
                    required
                    value={period.endDate}
                    onChange={(e) => handleDateChange(period.term, 'endDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Esses períodos organizam os lançamentos de frequência, conteúdos lecionados e fechamento de notas por etapa.</span>
      </div>
    </div>
  );
};
