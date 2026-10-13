import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart3,
  TableProperties,
  CheckSquare,
  BookOpenCheck,
  UserCheck,
  Users,
  ShieldAlert,
  Lock,
  ShieldCheck,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  FileText
} from 'lucide-react';

export type TabId =
  | 'overview'
  | 'grade-map'
  | 'attendance'
  | 'lessons'
  | 'student-list'
  | 'incidents'
  | 'reports'
  | 'management';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  studentCount: number;
  incidentCount?: number;
  isAdmin?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  studentCount,
  incidentCount,
  isAdmin = false
}) => {
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const tabs: {
    id: TabId;
    label: string;
    shortLabel?: string;
    fullLabel: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[] = [
    {
      id: 'overview',
      label: 'Visão Geral',
      shortLabel: 'Visão Geral',
      fullLabel: 'Visão Geral & Gráficos',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />
    },
    {
      id: 'grade-map',
      label: 'Mapa de Notas',
      shortLabel: 'Notas',
      fullLabel: 'Mapa de Notas & Médias',
      icon: <TableProperties className="w-4 h-4 shrink-0" />,
      badge: studentCount > 0 ? `${studentCount}` : undefined
    },
    {
      id: 'attendance',
      label: 'Chamada',
      shortLabel: 'Chamada',
      fullLabel: 'Chamada Diária & Frequência',
      icon: <CheckSquare className="w-4 h-4 shrink-0" />
    },
    {
      id: 'lessons',
      label: 'Conteúdos',
      shortLabel: 'Conteúdos',
      fullLabel: 'Diário de Conteúdos & Aulas',
      icon: <BookOpenCheck className="w-4 h-4 shrink-0" />
    },
    {
      id: 'student-list',
      label: 'Alunos',
      shortLabel: 'Alunos',
      fullLabel: 'Lista de Alunos da Turma',
      icon: <Users className="w-4 h-4 shrink-0" />
    },
    {
      id: 'incidents',
      label: 'Ocorrências',
      shortLabel: 'Ocorrências',
      fullLabel: 'Livro de Ocorrências Escolares',
      icon: <ShieldAlert className="w-4 h-4 shrink-0" />,
      badge: incidentCount && incidentCount > 0 ? incidentCount : undefined
    },
    {
      id: 'reports',
      label: 'Relatórios',
      shortLabel: 'Relatórios',
      fullLabel: 'Relatórios Oficiais & Diário de Classe',
      icon: <FileText className="w-4 h-4 shrink-0" />
    },
    {
      id: 'management',
      label: isAdmin ? 'Cadastros (Admin)' : 'Cadastros',
      shortLabel: 'Cadastros',
      fullLabel: isAdmin ? 'Cadastros & Usuários (Admin)' : 'Cadastros (Consulta)',
      icon: isAdmin ? (
        <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-500" />
      ) : (
        <Lock className="w-4 h-4 shrink-0 text-slate-400" />
      ),
      badge: isAdmin ? 'Admin' : 'Consulta'
    }
  ];

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = 250;
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    });
    setTimeout(checkScroll, 300);
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden w-full">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between gap-1 py-1.5 sm:py-2">
          {/* Scroll Left Button (if overflow) */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScroll('left')}
              title="Rolar menus para a esquerda"
              className="hidden sm:flex p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Horizontal Tabs Track - Full visibility on Desktop, Laptop and Tablet */}
          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex-1 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    onSelectTab(tab.id);
                    setIsMenuDropdownOpen(false);
                  }}
                  title={tab.fullLabel}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-xs md:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs font-bold ring-1 ring-indigo-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 bg-slate-50/80 border border-slate-200/80'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-500'}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button (if overflow) */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScroll('right')}
              title="Rolar menus para a direita"
              className="hidden sm:flex p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* "Todos os Menus" Button - Quick access grid on both PC and Mobile */}
          <div className="relative shrink-0 ml-1">
            <button
              type="button"
              onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
              title="Ver grade completa com todos os menus"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isMenuDropdownOpen
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Todos os Menus</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMenuDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded Dropdown Panel (Overlay grid of all 8 menus) */}
            {isMenuDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <LayoutGrid className="w-4 h-4 text-indigo-600" />
                    <span>Acesso a Todos os Menus</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMenuDropdownOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(tab.id);
                          setIsMenuDropdownOpen(false);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl text-xs text-left font-semibold transition cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 border border-slate-100'
                        }`}
                      >
                        <span className={isActive ? 'text-white' : 'text-slate-500'}>
                          {tab.icon}
                        </span>
                        <div className="flex items-center justify-between w-full min-w-0">
                          <span className="truncate">{tab.fullLabel}</span>
                          {tab.badge && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded-full font-bold ml-1 ${
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {tab.badge}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
