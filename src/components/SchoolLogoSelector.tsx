import React, { useRef, useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Check,
  Eye,
  Sparkles,
  HelpCircle,
  Building2,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';
import {
  getSchoolLogo,
  setSchoolLogo,
  getSchoolName,
  setSchoolName,
  getIncludeSchoolLogoPreference,
  setIncludeSchoolLogoPreference,
  subscribeSchoolConfig,
  resizeImageFileToBase64,
  getDefaultSchoolCrest,
  DEFAULT_SCHOOL_CREST,
  DEFAULT_SCHOOL_NAME
} from '../utils/schoolLogo';

interface SchoolLogoSelectorProps {
  includeLogo: boolean;
  onToggleIncludeLogo: (include: boolean) => void;
  currentLogo?: string | null;
  onLogoChange?: (logo: string | null) => void;
  schoolName?: string;
  onSchoolNameChange?: (name: string) => void;
  compact?: boolean;
  showSchoolNameInput?: boolean;
}

export const SchoolLogoSelector: React.FC<SchoolLogoSelectorProps> = ({
  includeLogo,
  onToggleIncludeLogo,
  currentLogo: propLogo,
  onLogoChange,
  schoolName: propSchoolName,
  onSchoolNameChange,
  compact = false,
  showSchoolNameInput = false
}) => {
  const [internalLogo, setInternalLogo] = useState<string | null>(() => propLogo !== undefined ? propLogo : getSchoolLogo());
  const [internalSchoolName, setInternalSchoolName] = useState<string>(() => propSchoolName || getSchoolName());
  const [isUploading, setIsUploading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with prop changes if provided
  useEffect(() => {
    if (propLogo !== undefined) {
      setInternalLogo(propLogo);
    }
  }, [propLogo]);

  useEffect(() => {
    if (propSchoolName !== undefined) {
      setInternalSchoolName(propSchoolName);
    }
  }, [propSchoolName]);

  // Subscribe to global school config changes
  useEffect(() => {
    const unsub = subscribeSchoolConfig(() => {
      if (propLogo === undefined) {
        setInternalLogo(getSchoolLogo());
      }
      if (propSchoolName === undefined) {
        setInternalSchoolName(getSchoolName());
      }
    });
    return unsub;
  }, [propLogo, propSchoolName]);

  const activeLogo = propLogo !== undefined ? propLogo : internalLogo;
  const activeName = propSchoolName !== undefined ? propSchoolName : internalSchoolName;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      if (!file.type.startsWith('image/')) {
        setUploadError('Selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).');
        setIsUploading(false);
        return;
      }

      const base64 = await resizeImageFileToBase64(file, 400);
      setInternalLogo(base64);
      setSchoolLogo(base64);
      if (onLogoChange) onLogoChange(base64);

      // Auto enable logo when uploaded
      if (!includeLogo) {
        onToggleIncludeLogo(true);
        setIncludeSchoolLogoPreference(true);
      }
    } catch (err: any) {
      setUploadError('Erro ao carregar imagem: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUseDefaultCrest = () => {
    const crest = getDefaultSchoolCrest();
    setInternalLogo(crest);
    setSchoolLogo(crest);
    if (onLogoChange) onLogoChange(crest);
    if (!includeLogo) {
      onToggleIncludeLogo(true);
      setIncludeSchoolLogoPreference(true);
    }
    setUploadError(null);
  };

  const handleRemoveLogo = () => {
    setInternalLogo(null);
    setSchoolLogo(null);
    if (onLogoChange) onLogoChange(null);
    setUploadError(null);
  };

  const handleNameChange = (val: string) => {
    setInternalSchoolName(val);
    setSchoolName(val);
    if (onSchoolNameChange) onSchoolNameChange(val);
  };

  // Compact Mode (for toolbars)
  if (compact) {
    return (
      <div className="relative inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1.5 transition">
        {/* Toggle Checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeLogo}
            onChange={(e) => {
              onToggleIncludeLogo(e.target.checked);
              setIncludeSchoolLogoPreference(e.target.checked);
            }}
            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
          />
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>Logo da Escola</span>
          </span>
        </label>

        {/* Thumbnail or Add Button */}
        {activeLogo ? (
          <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
            <img
              src={activeLogo}
              alt="Logo da Escola"
              className="w-5 h-5 object-contain rounded bg-white p-0.5 border border-slate-200 shadow-2xs"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Trocar logo da escola"
              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
            >
              Alterar
            </button>
            <button
              type="button"
              onClick={handleRemoveLogo}
              title="Remover logo"
              className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer pl-1 border-l border-slate-200"
            title="Enviar imagem do logo da escola"
          >
            <Upload className="w-3 h-3" />
            <span>Inserir Logo</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  // Full / Standard Mode (for Reports Controls Card)
  return (
    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/90 text-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeLogo}
            onChange={(e) => {
              onToggleIncludeLogo(e.target.checked);
              setIncludeSchoolLogoPreference(e.target.checked);
            }}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
          />
          <div>
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <span>Incluir Logo Oficial da Escola no Relatório</span>
            </span>
            <span className="text-[10px] text-slate-500 block">
              Aparece no cabeçalho timbrado impresso e nas exportações em PDF
            </span>
          </div>
        </label>

        {/* Logo Action & Preview */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {activeLogo ? (
            <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
              <img
                src={activeLogo}
                alt="Brasão da Escola"
                className="w-7 h-7 object-contain rounded bg-slate-50 p-0.5 border border-slate-100"
              />
              <div className="text-[10px] leading-tight pr-1">
                <span className="font-bold text-emerald-700 block">Logo Ativo</span>
                <span className="text-slate-400">Pronto para impressão</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[10px] transition cursor-pointer"
                title="Substituir por outra imagem"
              >
                {isUploading ? 'Enviando...' : 'Alterar'}
              </button>
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                title="Remover logo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Enviando...' : 'Carregar Logo da Escola'}</span>
              </button>
              <button
                type="button"
                onClick={handleUseDefaultCrest}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 font-semibold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                title="Usar brasão institucional padrão"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Usar Brasão Padrão</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px]">
          {uploadError}
        </div>
      )}

      {/* Optional School Name field */}
      {showSchoolNameInput && (
        <div className="pt-2 border-t border-slate-200/80">
          <label className="text-[11px] font-bold text-slate-700 block mb-1">
            Nome da Escola / Instituição de Ensino:
          </label>
          <div className="relative">
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Ex: Escola Municipal Santos Dumont"
              value={activeName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};
