import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ClassRoom,
  Student,
  Assessment,
  GradeRecord,
  AttendanceRecord,
  LessonContent,
  StudentObservation,
  TermRecoveryRecord,
  FinalRecoveryRecord,
  StudentIncident,
  IncidentTypeDefinition,
  BookAssignment,
  StudentBookCheck
} from '../types';
import {
  calculateStudentTermAverage,
  calculateStudentOverallAverage,
  calculateStudentAttendance,
  getTermLabel,
  getTermCount
} from './calculations';
import {
  getSchoolLogo,
  getSchoolName,
  getIncludeSchoolLogoPreference
} from './schoolLogo';

/**
 * Helper to safely draw a school logo in a jsPDF document.
 * Scales the image proportionally within maxW x maxH.
 * Returns the drawn width and height in mm.
 */
function drawSchoolLogoInPDF(
  doc: jsPDF,
  logoDataUrl: string,
  x: number,
  y: number,
  maxW = 16,
  maxH = 16
): { width: number; height: number } {
  try {
    const props = doc.getImageProperties(logoDataUrl);
    const aspect = props.width && props.height ? props.width / props.height : 1;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    const format = props.fileType || (logoDataUrl.includes('png') ? 'PNG' : 'JPEG');
    doc.addImage(logoDataUrl, format, x, y, w, h, undefined, 'FAST');
    return { width: w, height: h };
  } catch (err) {
    try {
      doc.addImage(logoDataUrl, 'PNG', x, y, maxW, maxH, undefined, 'FAST');
      return { width: maxW, height: maxH };
    } catch (e) {
      console.warn('Erro ao inserir logo no PDF:', e);
      return { width: 0, height: 0 };
    }
  }
}

/**
 * Generates and downloads a Grade Map PDF (Mapa de Notas da Turma)
 * including Recuperação Paralela and Recuperação Final
 */
export function generateGradeMapPDF(
  currentClass: ClassRoom,
  students: Student[],
  assessments: Assessment[],
  gradeRecords: GradeRecord[],
  selectedTerm: number,
  viewMode: 'term' | 'annual' = 'term',
  termRecoveries: TermRecoveryRecord[] = [],
  finalRecoveries: FinalRecoveryRecord[] = [],
  options?: {
    schoolName?: string;
    schoolLogo?: string | null;
    includeLogo?: boolean;
  }
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const activeStudents = students
    .filter(s => s.classId === currentClass.id && s.status === 'active')
    .sort((a, b) => a.rollNumber - b.rollNumber);

  const termAssessments = assessments.filter(
    a => a.classId === currentClass.id && Number(a.term) === Number(selectedTerm)
  );

  const numTerms = getTermCount(currentClass.termType);

  const shouldIncludeLogo = options?.includeLogo !== undefined ? options.includeLogo : getIncludeSchoolLogoPreference();
  const activeLogo = shouldIncludeLogo ? (options?.schoolLogo !== undefined ? options.schoolLogo : getSchoolLogo()) : null;
  const activeSchoolName = options?.schoolName || getSchoolName();

  // Document Title & Header
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 297, 26, 'F');

  let textX = 14;
  if (activeLogo) {
    const logoRes = drawSchoolLogoInPDF(doc, activeLogo, 14, 4, 18, 18);
    if (logoRes.width > 0) {
      textX = 14 + logoRes.width + 4;
    }
  }

  let textY = 8.5;
  if (activeSchoolName) {
    doc.setTextColor(251, 191, 36); // Amber-400
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(activeSchoolName.toUpperCase(), textX, textY);
    textY += 5;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DIÁRIO DO PROFESSOR - MAPA DE NOTAS DA TURMA', textX, textY);

  textY += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const termTitle = viewMode === 'term' ? getTermLabel(currentClass.termType, selectedTerm) : 'Consolidado Anual';
  doc.text(
    `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | Período: ${termTitle} | Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
    textX,
    textY
  );

  let head: string[][] = [];
  let body: any[][] = [];

  if (viewMode === 'term') {
    const asmHeaders = termAssessments.map(
      a => `${a.name}\n(P:${a.weight || 1})`
    );
    head = [
      [
        'Nº',
        'Matrícula',
        'Nome do Estudante',
        ...asmHeaders,
        'Média\nRegular',
        'Rec.\nParalela',
        `Média Final\n${getTermLabel(currentClass.termType, selectedTerm)}`,
        'Situação'
      ]
    ];

    body = activeStudents.map(student => {
      const row: any[] = [
        String(student.rollNumber).padStart(2, '0'),
        student.enrollmentNumber || '—',
        student.name
      ];

      termAssessments.forEach(asm => {
        const grade = gradeRecords.find(g => g.assessmentId === asm.id && g.studentId === student.id);
        row.push(grade && grade.score !== null ? Number(grade.score).toFixed(1) : '—');
      });

      const termRes = calculateStudentTermAverage(
        student.id,
        currentClass.id,
        selectedTerm,
        assessments,
        gradeRecords,
        currentClass.gradeCalculationType,
        termRecoveries
      );

      row.push(termRes.regularAverage !== null ? termRes.regularAverage.toFixed(1) : '—');
      row.push(termRes.recoveryScore !== null ? termRes.recoveryScore.toFixed(1) : '—');

      const finalAvgText = termRes.average !== null
        ? `${termRes.average.toFixed(1)}${termRes.isSubstituted ? ' *' : ''}`
        : '—';
      row.push(finalAvgText);

      const isApproved = termRes.average !== null && termRes.average >= currentClass.passingGrade;
      row.push(
        termRes.average !== null
          ? isApproved
            ? termRes.isSubstituted
              ? 'Aprovado (Rec)'
              : 'Aprovado'
            : 'Recuperação'
          : 'Pendente'
      );

      return row;
    });
  } else {
    // Annual View with Recuperação Final
    const termHeaders = Array.from({ length: numTerms }).map(
      (_, i) => getTermLabel(currentClass.termType, i + 1)
    );
    head = [
      [
        'Nº',
        'Matrícula',
        'Nome do Estudante',
        ...termHeaders,
        'Total\nPontos',
        'Média\nAnual',
        'Rec.\nFinal',
        'Média\nDefinitiva',
        'Situação Final'
      ]
    ];

    body = activeStudents.map(student => {
      const row: any[] = [
        String(student.rollNumber).padStart(2, '0'),
        student.enrollmentNumber || '—',
        student.name
      ];

      const annualRes = calculateStudentOverallAverage(
        student.id,
        currentClass,
        assessments,
        gradeRecords,
        termRecoveries,
        finalRecoveries
      );

      annualRes.termsSummary.forEach(ts => {
        row.push(ts.average !== null ? ts.average.toFixed(1) : '—');
      });

      row.push(annualRes.termsWithGrades > 0 ? annualRes.totalPoints.toFixed(1) : '—');
      row.push(annualRes.annualAverage !== null ? annualRes.annualAverage.toFixed(1) : '—');
      row.push(annualRes.finalRecoveryScore !== null ? annualRes.finalRecoveryScore.toFixed(1) : '—');
      row.push(annualRes.definitiveAverage !== null ? annualRes.definitiveAverage.toFixed(1) : '—');

      let sitText = 'Pendente';
      if (annualRes.status === 'approved') sitText = 'Aprovado';
      else if (annualRes.status === 'approved_recovery') sitText = 'Aprovado (Rec. Final)';
      else if (annualRes.status === 'failed') sitText = 'Reprovado';
      else if (annualRes.status === 'recovery') sitText = 'Em Rec. Final';

      row.push(sitText);
      return row;
    });
  }

  autoTable(doc, {
    head,
    body,
    startY: activeLogo ? 30 : 28,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 24 },
      2: { cellWidth: 50 }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const text = String(data.cell.raw);
        if (text.startsWith('Aprovado')) {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'Recuperação' || text === 'Reprovado' || text === 'Em Rec. Final') {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 14;
  if (finalY < 190) {
    doc.setDrawColor(180, 180, 180);
    doc.line(30, finalY, 110, finalY);
    doc.line(180, finalY, 260, finalY);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Professor(a) Responsável', 70, finalY + 4, { align: 'center' });
    doc.text('Coordenação Pedagógica / Direção', 220, finalY + 4, { align: 'center' });
  }

  const filename = `Mapa_Notas_${currentClass.name.replace(/\s+/g, '_')}_${viewMode === 'term' ? getTermLabel(currentClass.termType, selectedTerm) : 'Anual'}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads an Attendance Report PDF (Relatório Oficial de Frequência)
 */
export function generateAttendanceReportPDF(
  currentClass: ClassRoom,
  students: Student[],
  attendances: AttendanceRecord[],
  selectedTerm: number,
  options?: {
    schoolName?: string;
    schoolLogo?: string | null;
    includeLogo?: boolean;
  }
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const activeStudents = students
    .filter(s => s.classId === currentClass.id && s.status === 'active')
    .sort((a, b) => a.rollNumber - b.rollNumber);

  const shouldIncludeLogo = options?.includeLogo !== undefined ? options.includeLogo : getIncludeSchoolLogoPreference();
  const activeLogo = shouldIncludeLogo ? (options?.schoolLogo !== undefined ? options.schoolLogo : getSchoolLogo()) : null;
  const activeSchoolName = options?.schoolName || getSchoolName();

  // Top Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 26, 'F');

  let textX = 14;
  if (activeLogo) {
    const logoRes = drawSchoolLogoInPDF(doc, activeLogo, 14, 4, 18, 18);
    if (logoRes.width > 0) {
      textX = 14 + logoRes.width + 4;
    }
  }

  let textY = 8.5;
  if (activeSchoolName) {
    doc.setTextColor(251, 191, 36); // Amber-400
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(activeSchoolName.toUpperCase(), textX, textY);
    textY += 4.5;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO OFICIAL DE FREQUÊNCIA E ASSIDUIDADE', textX, textY);

  textY += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(
    `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | ${getTermLabel(currentClass.termType, selectedTerm)} | Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
    textX,
    textY
  );

  const head = [['Nº', 'Matrícula', 'Nome do Estudante', 'Aulas', 'Pres.', 'Faltas', 'Just.', 'Freq. %', 'Situação Legal']];

  let totalStudents = activeStudents.length;
  let atRiskCount = 0;
  let sumRates = 0;

  const body = activeStudents.map(student => {
    const att = calculateStudentAttendance(student.id, currentClass.id, attendances, selectedTerm);
    const isRisk = att.totalClasses > 0 && att.attendanceRate < 75;
    if (isRisk) atRiskCount++;
    sumRates += att.attendanceRate;

    return [
      String(student.rollNumber).padStart(2, '0'),
      student.enrollmentNumber || '—',
      student.name,
      att.totalClasses,
      att.presents,
      att.absents,
      att.justified,
      `${att.attendanceRate}%`,
      isRisk ? 'Risco (<75%)' : 'Regular'
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: activeLogo ? 32 : 30,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      font: 'helvetica',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 22 },
      2: { cellWidth: 65 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      8: { halign: 'center', cellWidth: 24, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const text = String(data.cell.raw);
        if (text === 'Regular') {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (text === 'Risco (<75%)') {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    }
  });

  // Summary box
  const avgClassRate = totalStudents > 0 ? Math.round(sumRates / totalStudents) : 100;
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY, 182, 16, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`Média de Frequência da Sala: ${avgClassRate}%`, 18, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Estudantes Regulares: ${totalStudents - atRiskCount} | Alunos em Risco Pedagógico (<75% de presença conforme LDB): ${atRiskCount}`,
    18,
    finalY + 12
  );

  // Signatures
  const signY = finalY + 34;
  if (signY < 275) {
    doc.setDrawColor(180, 180, 180);
    doc.line(20, signY, 90, signY);
    doc.line(120, signY, 190, signY);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Professor(a) Responsável', 55, signY + 4, { align: 'center' });
    doc.text('Visto da Coordenação Pedagógica', 155, signY + 4, { align: 'center' });
  }

  const filename = `Relatorio_Frequencia_${currentClass.name.replace(/\s+/g, '_')}_${getTermLabel(currentClass.termType, selectedTerm)}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads a Lesson Diary PDF (Relatório de Conteúdos Ministrados)
 */
export function generateLessonDiaryPDF(
  currentClass: ClassRoom,
  lessons: LessonContent[],
  selectedTerm: number,
  options?: {
    schoolName?: string;
    schoolLogo?: string | null;
    includeLogo?: boolean;
  }
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const classLessons = lessons
    .filter(l => l.classId === currentClass.id && Number(l.term) === Number(selectedTerm))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalAulas = classLessons.reduce((acc, curr) => acc + (Number(curr.lessonCount) || 1), 0);

  const shouldIncludeLogo = options?.includeLogo !== undefined ? options.includeLogo : getIncludeSchoolLogoPreference();
  const activeLogo = shouldIncludeLogo ? (options?.schoolLogo !== undefined ? options.schoolLogo : getSchoolLogo()) : null;
  const activeSchoolName = options?.schoolName || getSchoolName();

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 26, 'F');

  let textX = 14;
  if (activeLogo) {
    const logoRes = drawSchoolLogoInPDF(doc, activeLogo, 14, 4, 18, 18);
    if (logoRes.width > 0) {
      textX = 14 + logoRes.width + 4;
    }
  }

  let textY = 8.5;
  if (activeSchoolName) {
    doc.setTextColor(251, 191, 36); // Amber-400
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(activeSchoolName.toUpperCase(), textX, textY);
    textY += 4.5;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DIÁRIO DE CLASSE - CONTEÚDOS MINISTRADOS', textX, textY);

  textY += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(
    `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | ${getTermLabel(currentClass.termType, selectedTerm)} | Total: ${totalAulas} Aulas`,
    textX,
    textY
  );

  const head = [['Data / Aulas', 'Status', 'Tema & Conteúdo Ministrado', 'BNCC / Tarefa & Links']];

  const body = classLessons.map(lesson => {
    const dateFormatted = lesson.date ? lesson.date.split('-').reverse().join('/') : '—';
    const aulas = `${dateFormatted}\n(${lesson.lessonCount || 1} ${lesson.lessonCount > 1 ? 'aulas' : 'aula'})`;
    const statusText = lesson.status === 'previsto' ? 'Previsto' : 'Dado';

    const topicAndDesc = `${lesson.topic.toUpperCase()}\n\n${lesson.contentDescription}`;

    let extra = '';
    if (lesson.bnccSkills) extra += `BNCC: ${lesson.bnccSkills}\n`;
    if (lesson.homework) extra += `Tarefa: ${lesson.homework}\n`;
    if (lesson.externalLink) {
      const linkLabel = lesson.externalLinkTitle || 'Link de Apoio';
      extra += `Material: ${linkLabel}\n(${lesson.externalLink})`;
    }

    return [aulas, statusText, topicAndDesc, extra.trim() || '—'];
  });

  autoTable(doc, {
    head,
    body,
    startY: activeLogo ? 32 : 30,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      font: 'helvetica',
      valign: 'top'
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 92 },
      3: { cellWidth: 45, fontSize: 8 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 18;
  if (finalY < 270) {
    doc.setDrawColor(180, 180, 180);
    doc.line(20, finalY, 90, finalY);
    doc.line(120, finalY, 190, finalY);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Assinatura do(a) Professor(a)', 55, finalY + 4, { align: 'center' });
    doc.text('Visto da Coordenação Pedagógica', 155, finalY + 4, { align: 'center' });
  }

  const filename = `Diario_Conteudos_${currentClass.name.replace(/\s+/g, '_')}_${getTermLabel(currentClass.termType, selectedTerm)}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads an Individual Student Bulletin PDF (Boletim Escolar)
 */
export function generateStudentBulletinPDF(
  currentClass: ClassRoom,
  student: Student,
  assessments: Assessment[],
  gradeRecords: GradeRecord[],
  attendances: AttendanceRecord[],
  observations: StudentObservation[],
  selectedTerm: number,
  termRecoveries: TermRecoveryRecord[] = [],
  finalRecoveries: FinalRecoveryRecord[] = [],
  options?: {
    schoolName?: string;
    schoolLogo?: string | null;
    includeLogo?: boolean;
  }
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const annualRes = calculateStudentOverallAverage(
    student.id,
    currentClass,
    assessments,
    gradeRecords,
    termRecoveries,
    finalRecoveries
  );

  const attendance = calculateStudentAttendance(student.id, currentClass.id, attendances);

  const shouldIncludeLogo = options?.includeLogo !== undefined ? options.includeLogo : getIncludeSchoolLogoPreference();
  const activeLogo = shouldIncludeLogo ? (options?.schoolLogo !== undefined ? options.schoolLogo : getSchoolLogo()) : null;
  const activeSchoolName = options?.schoolName || getSchoolName();

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 28, 'F');

  let textX = 14;
  if (activeLogo) {
    const logoRes = drawSchoolLogoInPDF(doc, activeLogo, 14, 4, 20, 20);
    if (logoRes.width > 0) {
      textX = 14 + logoRes.width + 4;
    }
  }

  let textY = 9;
  if (activeSchoolName) {
    doc.setTextColor(251, 191, 36);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(activeSchoolName.toUpperCase(), textX, textY);
    textY += 5;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('BOLETIM ESCOLAR E DESEMPENHO INDIVIDUAL', textX, textY);

  textY += 5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(
    `Registro Acadêmico Oficial | Turma: ${currentClass.name} | Disciplina: ${currentClass.subject}`,
    textX,
    textY
  );

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 32, 182, 24, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Aluno(a): ${student.name}`, 18, 39);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº de Chamada: ${String(student.rollNumber).padStart(2, '0')} | Matrícula: ${student.enrollmentNumber || '—'}`, 18, 45);
  doc.text(
    `Responsável: ${student.guardianName || 'Não informado'} ${student.guardianPhone ? `(${student.guardianPhone})` : ''}`,
    18,
    51
  );

  doc.setFont('helvetica', 'bold');
  let situacaoLabel = 'Em Avaliação';
  if (annualRes.status === 'approved') situacaoLabel = 'Aprovado';
  else if (annualRes.status === 'approved_recovery') situacaoLabel = 'Aprovado (após Rec. Final)';
  else if (annualRes.status === 'failed') situacaoLabel = 'Reprovado';
  else if (annualRes.status === 'recovery') situacaoLabel = 'Em Recuperação Final';

  doc.text(`Situação: ${situacaoLabel}`, 125, 39);
  doc.setFont('helvetica', 'normal');
  doc.text(`Média Mínima: ${currentClass.passingGrade.toFixed(1)}`, 125, 45);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 60, 182, 16, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('MÉDIA ANUAL', 22, 65);
  doc.text('REC. FINAL', 65, 65);
  doc.text('MÉDIA FINAL', 105, 65);
  doc.text('FREQUÊNCIA', 145, 65);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(annualRes.annualAverage !== null ? annualRes.annualAverage.toFixed(1) : '—', 22, 72);
  doc.text(annualRes.finalRecoveryScore !== null ? annualRes.finalRecoveryScore.toFixed(1) : '—', 65, 72);
  doc.text(annualRes.definitiveAverage !== null ? annualRes.definitiveAverage.toFixed(1) : '—', 105, 72);
  doc.text(`${attendance.attendanceRate}%`, 145, 72);

  const tableHead = [['Período', 'Avaliações do Período', 'Média Reg.', 'Rec. Paralela', 'Média Final', 'Situação']];
  const tableBody = annualRes.termsSummary.map(item => {
    const asmList = item.assessmentScores.length === 0
      ? 'Nenhuma avaliação realizada'
      : item.assessmentScores.map(a => `${a.assessmentName}: ${a.score !== null ? a.score.toFixed(1) : 'S/N'}`).join(' | ');

    const isTermApp = item.average !== null && item.average >= currentClass.passingGrade;

    return [
      getTermLabel(currentClass.termType, item.term),
      asmList,
      item.regularAverage !== null ? item.regularAverage.toFixed(1) : '—',
      item.recoveryScore !== null ? `${item.recoveryScore.toFixed(1)}${item.isSubstituted ? ' (Subst.)' : ''}` : '—',
      item.average !== null ? item.average.toFixed(1) : '—',
      item.average !== null ? (isTermApp ? 'Aprovado' : 'Recuperação') : 'Pendente'
    ];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 81,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const obs = observations.find(o => o.studentId === student.id && Number(o.term) === Number(selectedTerm));

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY, 182, 34, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`PARECER DESCRITIVO DO PROFESSOR (${getTermLabel(currentClass.termType, selectedTerm)})`, 18, finalY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const parecerText = obs?.observation || 'Sem observações pedagógicas registradas para este período letivo.';
  const splitText = doc.splitTextToSize(parecerText, 174);
  doc.text(splitText, 18, finalY + 14);

  const signY = finalY + 48;
  if (signY < 275) {
    doc.setDrawColor(180, 180, 180);
    doc.line(20, signY, 90, signY);
    doc.line(120, signY, 190, signY);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Professor(a) Responsável', 55, signY + 4, { align: 'center' });
    doc.text('Visto da Coordenação Pedagógica', 155, signY + 4, { align: 'center' });
  }

  const filename = `Boletim_${student.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads Student List PDF (Lista de Alunos por Turma)
 */
export function generateStudentListPDF(
  currentClass: ClassRoom,
  students: Student[],
  mode: 'chamada' | 'assinatura' | 'cadastral' | 'desempenho' = 'chamada',
  options?: {
    schoolName?: string;
    schoolLogo?: string | null;
    includeLogo?: boolean;
    customTitle?: string;
    blankColumnsCount?: number;
    showSignatures?: boolean;
    onlyActive?: boolean;
  }
): void {
  const isLandscape = mode === 'chamada' && (options?.blankColumnsCount || 10) > 8;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = isLandscape ? 297 : 210;

  const filteredStudents = students
    .filter(s => s.classId === currentClass.id && (options?.onlyActive !== false ? s.status === 'active' : true))
    .sort((a, b) => a.rollNumber - b.rollNumber);

  const shouldIncludeLogo = options?.includeLogo !== undefined ? options.includeLogo : getIncludeSchoolLogoPreference();
  const activeLogo = shouldIncludeLogo ? (options?.schoolLogo !== undefined ? options.schoolLogo : getSchoolLogo()) : null;
  const activeSchoolName = options?.schoolName || getSchoolName();

  // Clean, official printable header - NO BLACK BACKGROUND!
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 28, 'F');

  const titleText = options?.customTitle || (
    mode === 'chamada' ? 'LISTA DE CHAMADA DA TURMA (DIÁRIO DE CLASSE)' :
    mode === 'assinatura' ? 'LISTA DE ASSINATURA / ENTREGA DE AVALIAÇÕES' :
    mode === 'cadastral' ? 'FICHA CADASTRAL E CONTATOS DA TURMA' :
    'RELAÇÃO GERAL DE ALUNOS DA TURMA'
  );

  let textX = 14;
  let logoH = 0;
  if (activeLogo) {
    const logoRes = drawSchoolLogoInPDF(doc, activeLogo, 14, 6, 17, 17);
    if (logoRes.width > 0) {
      textX = 14 + logoRes.width + 4;
      logoH = logoRes.height;
    }
  }

  let currentHeaderY = 9.5;
  if (activeSchoolName && activeSchoolName.trim()) {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(activeSchoolName.trim().toUpperCase(), textX, currentHeaderY);
    currentHeaderY += 5;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(titleText, textX, currentHeaderY);

  currentHeaderY += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | Turno: ${currentClass.shift} | Total: ${filteredStudents.length} Alunos | Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
    textX,
    currentHeaderY
  );

  const actualSepY = Math.max(currentHeaderY + 3.5, logoH > 0 ? 6 + logoH + 2.5 : 24);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, actualSepY, pageWidth - 14, actualSepY);

  let head: any[][] = [];
  let body: any[][] = [];

  if (mode === 'chamada') {
    const colCount = options?.blankColumnsCount || 10;
    const blankHeaders = Array.from({ length: colCount }, (_, i) => `__/__\n(${i + 1})`);
    head = [['Nº', 'Matrícula', 'Nome do Estudante', ...blankHeaders]];

    body = filteredStudents.map(student => {
      const displayName = student.status === 'canceled'
        ? `${student.name} (CANCELADO - SAÍDA)`
        : student.status === 'transferred'
        ? `${student.name} (TRANSFERIDO)`
        : student.name;
      return [
        String(student.rollNumber).padStart(2, '0'),
        student.enrollmentNumber || '—',
        displayName,
        ...Array.from({ length: colCount }, () => '')
      ];
    });
  } else if (mode === 'assinatura') {
    head = [['Nº', 'Matrícula', 'Nome do Estudante', 'Data', 'Assinatura / Rubrica do Estudante ou Responsável']];
    body = filteredStudents.map(student => {
      const displayName = student.status === 'canceled'
        ? `${student.name} (CANCELADO - SAÍDA)`
        : student.status === 'transferred'
        ? `${student.name} (TRANSFERIDO)`
        : student.name;
      return [
        String(student.rollNumber).padStart(2, '0'),
        student.enrollmentNumber || '—',
        displayName,
        '',
        ''
      ];
    });
  } else if (mode === 'cadastral') {
    head = [['Nº', 'Matrícula', 'Nome do Estudante', 'Responsável', 'Telefone de Contato', 'Situação']];
    body = filteredStudents.map(student => [
      String(student.rollNumber).padStart(2, '0'),
      student.enrollmentNumber || '—',
      student.name,
      student.guardianName || '—',
      student.guardianPhone || '—',
      student.status === 'active'
        ? 'Ativo'
        : student.status === 'canceled'
        ? 'Cancelado'
        : student.status === 'transferred'
        ? 'Transferido'
        : 'Inativo'
    ]);
  } else {
    head = [['Nº', 'Matrícula', 'Nome do Estudante', 'Situação', 'Observações']];
    body = filteredStudents.map(student => [
      String(student.rollNumber).padStart(2, '0'),
      student.enrollmentNumber || '—',
      student.name,
      student.status === 'active'
        ? 'Ativo'
        : student.status === 'canceled'
        ? 'Cancelado'
        : student.status === 'transferred'
        ? 'Transferido'
        : 'Inativo',
      student.notes || '—'
    ]);
  }

  autoTable(doc, {
    head,
    body,
    startY: actualSepY + 3.5,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: mode === 'chamada' ? 2 : 2.5,
      font: 'helvetica',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.2,
      lineColor: [203, 213, 225]
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: mode === 'chamada' ? 55 : 65 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 14;
  const maxSafeY = isLandscape ? 180 : 265;

  if (options?.showSignatures !== false && finalY < maxSafeY) {
    const leftX = isLandscape ? 40 : 20;
    const rightX = isLandscape ? 180 : 120;
    const lineWidth = isLandscape ? 80 : 70;

    doc.setDrawColor(180, 180, 180);
    doc.line(leftX, finalY, leftX + lineWidth, finalY);
    doc.line(rightX, finalY, rightX + lineWidth, finalY);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Professor(a) Responsável', leftX + lineWidth / 2, finalY + 4, { align: 'center' });
    doc.text('Visto da Coordenação / Secretaria', rightX + lineWidth / 2, finalY + 4, { align: 'center' });
  }

  const filename = `Lista_Alunos_${currentClass.name.replace(/\s+/g, '_')}_${mode}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads the Caródromo / Carômetro PDF
 * (Painel oficial com fotos, nomes, números de chamada e matrículas de todos os estudantes)
 */
export function generateCarodromoPDF(
  currentClass: ClassRoom,
  students: Student[],
  options?: {
    schoolName?: string;
    schoolLogo?: string | null;
    includeLogo?: boolean;
    onlyActive?: boolean;
    customTitle?: string;
  }
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const topMargin = 33;

  const shouldIncludeLogo = options?.includeLogo !== undefined ? options.includeLogo : getIncludeSchoolLogoPreference();
  const activeLogo = shouldIncludeLogo ? (options?.schoolLogo !== undefined ? options.schoolLogo : getSchoolLogo()) : null;
  const activeSchoolName = options?.schoolName || getSchoolName();

  const filteredStudents = students
    .filter(s => s.classId === currentClass.id && (options?.onlyActive !== false ? s.status === 'active' : true))
    .sort((a, b) => a.rollNumber - b.rollNumber);

  // 4 columns x 4 rows = 16 students per page
  const cols = 4;
  const rows = 4;
  const studentsPerPage = cols * rows;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / studentsPerPage));

  const gapX = 4;
  const gapY = 4.5;
  const availableWidth = pageWidth - (marginX * 2);
  const cardWidth = (availableWidth - (gapX * (cols - 1))) / cols; // ~42.5mm
  const cardHeight = 54; // mm

  const drawPlaceholder = (targetDoc: jsPDF, student: Student, x: number, y: number, size: number) => {
    targetDoc.setFillColor(241, 245, 249);
    targetDoc.setDrawColor(203, 213, 225);
    targetDoc.setLineWidth(0.2);
    targetDoc.roundedRect(x, y, size, size, 2, 2, 'FD');

    const initials = student.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');

    targetDoc.setFontSize(10);
    targetDoc.setFont('helvetica', 'bold');
    targetDoc.setTextColor(99, 102, 241); // indigo-500
    targetDoc.text(initials || `Nº ${student.rollNumber}`, x + size / 2, y + size / 2 + 1.5, { align: 'center' });

    targetDoc.setFontSize(5.5);
    targetDoc.setFont('helvetica', 'normal');
    targetDoc.setTextColor(148, 163, 184);
    targetDoc.text('Sem foto', x + size / 2, y + size - 2, { align: 'center' });
  };

  const drawHeader = (pageNumber: number) => {
    // Header banner
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, pageWidth, 25, 'F');

    let textX = marginX;
    if (activeLogo) {
      const logoRes = drawSchoolLogoInPDF(doc, activeLogo, marginX, 3.5, 18, 18);
      if (logoRes.width > 0) {
        textX = marginX + logoRes.width + 4;
      }
    }

    let textY = 8;
    if (activeSchoolName && activeSchoolName.trim()) {
      doc.setTextColor(251, 191, 36); // Amber-400
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(activeSchoolName.trim().toUpperCase(), textX, textY);
      textY += 4.5;
    }

    const headerTitle = (options?.customTitle || 'CARÓDROMO DA TURMA - FOTOS DOS ESTUDANTES').toUpperCase();
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(headerTitle, textX, textY);

    textY += 4.5;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240);
    doc.text(
      `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | Turno: ${currentClass.shift} | Total: ${filteredStudents.length} Estudantes | Página ${pageNumber} de ${totalPages}`,
      textX,
      textY
    );
  };

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      doc.addPage();
    }
    drawHeader(page + 1);

    const startIdx = page * studentsPerPage;
    const pageStudents = filteredStudents.slice(startIdx, startIdx + studentsPerPage);

    pageStudents.forEach((student, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const cardX = marginX + col * (cardWidth + gapX);
      const cardY = topMargin + row * (cardHeight + gapY);

      // Card bounding box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'FD');

      // Top badge: Roll number
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(cardX + 2, cardY + 2, 14, 5, 1, 1, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text(`Nº ${String(student.rollNumber).padStart(2, '0')}`, cardX + 9, cardY + 5.5, { align: 'center' });

      // Status pill if not active
      if (student.status !== 'active') {
        const isCanceled = student.status === 'canceled';
        doc.setFillColor(isCanceled ? 255 : 254, isCanceled ? 241 : 243, isCanceled ? 242 : 199);
        doc.roundedRect(cardX + cardWidth - 19, cardY + 2, 17, 5, 1, 1, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(isCanceled ? 225 : 180, isCanceled ? 29 : 83, isCanceled ? 72 : 9);
        doc.text(isCanceled ? 'CANCELADO' : 'TRANSF.', cardX + cardWidth - 10.5, cardY + 5.5, { align: 'center' });
      }

      // Photo Box (Square 26mm x 26mm, centered)
      const photoSize = 25;
      const photoX = cardX + (cardWidth - photoSize) / 2;
      const photoY = cardY + 8.5;

      if (student.photoUrl) {
        try {
          const format = student.photoUrl.includes('png') ? 'PNG' : 'JPEG';
          doc.addImage(student.photoUrl, format, photoX, photoY, photoSize, photoSize, undefined, 'FAST');
          // Border around photo
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.2);
          doc.rect(photoX, photoY, photoSize, photoSize);
        } catch (e) {
          drawPlaceholder(doc, student, photoX, photoY, photoSize);
        }
      } else {
        drawPlaceholder(doc, student, photoX, photoY, photoSize);
      }

      // Student Name (multiline text wrap)
      const nameY = photoY + photoSize + 4.5;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59); // slate-800
      const splitName = doc.splitTextToSize(student.name, cardWidth - 4);
      const nameLines = splitName.slice(0, 2);
      doc.text(nameLines, cardX + cardWidth / 2, nameY, { align: 'center' });

      // Enrollment / RA
      const raY = nameY + (nameLines.length > 1 ? 6.5 : 4.5);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // slate-500
      const raText = student.enrollmentNumber ? `RA: ${student.enrollmentNumber}` : 'RA: —';
      doc.text(raText, cardX + cardWidth / 2, Math.min(raY, cardY + cardHeight - 2.5), { align: 'center' });
    });

    // Page footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Diário do Professor • Caródromo Oficial da Turma ${currentClass.name} • Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
      marginX,
      pageHeight - 8
    );
    doc.text(`Página ${page + 1} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  const filename = `Carodromo_${currentClass.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads the Official Class Diary with Attendance & Lessons Content
 * (Diário de Classe Completo: Frequência/Chamada + Conteúdos Ministrados)
 */
export function generateClassDiaryAttendanceAndLessonsPDF(
  currentClass: ClassRoom,
  students: Student[],
  attendances: AttendanceRecord[],
  lessons: LessonContent[],
  options?: {
    schoolName?: string;
    schoolLogo?: string | null;
    includeLogo?: boolean;
    selectedTerm?: number;
    teacherName?: string;
  }
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const term = options?.selectedTerm || 1;
  const termLabel = getTermLabel(currentClass.termType, term);

  const shouldIncludeLogo = options?.includeLogo !== undefined ? options.includeLogo : getIncludeSchoolLogoPreference();
  const activeLogo = shouldIncludeLogo ? (options?.schoolLogo !== undefined ? options.schoolLogo : getSchoolLogo()) : null;
  const activeSchoolName = options?.schoolName || getSchoolName();

  // Filter lessons for this class and term (or all if term is 0)
  const classLessons = lessons
    .filter(l => l.classId === currentClass.id && (term === 0 || l.term === term))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Distinct dates with lessons
  // Distinct dates from lessons AND attendances
  const attendanceDates = Array.from(
    new Set(
      attendances
        .filter(a => a.classId === currentClass.id && (term === 0 || a.term === term))
        .map(a => a.date)
    )
  );
  const lessonDates = Array.from(new Set([...classLessons.map(l => l.date), ...attendanceDates])).sort();

  // Filter active students
  const activeStudents = students
    .filter(s => s.classId === currentClass.id && s.status === 'active')
    .sort((a, b) => a.rollNumber - b.rollNumber);

  // 1. Clean Header (NO BLACK BACKGROUND, clean institutional typography)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 28, 'F');

  let textX = 14;
  let logoH = 0;
  if (activeLogo) {
    const logoRes = drawSchoolLogoInPDF(doc, activeLogo, 14, 6, 17, 17);
    if (logoRes.width > 0) {
      textX = 14 + logoRes.width + 4;
      logoH = logoRes.height;
    }
  }

  let currentY = 9.5;
  if (activeSchoolName && activeSchoolName.trim()) {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(activeSchoolName.trim().toUpperCase(), textX, currentY);
    currentY += 5;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`DIÁRIO DE CLASSE: FREQUÊNCIA (CHAMADA) & CONTEÚDOS MINISTRADOS — ${termLabel.toUpperCase()}`, textX, currentY);

  currentY += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const teacherInfo = options?.teacherName ? ` | Professor(a): ${options.teacherName}` : '';
  const totalLessonsTaught = classLessons
    .filter(l => (l.status || 'dado') === 'dado')
    .reduce((acc, l) => acc + (l.lessonCount || 1), 0);
  const totalLessonsPlanned = classLessons
    .filter(l => l.status === 'previsto')
    .reduce((acc, l) => acc + (l.lessonCount || 1), 0);

  doc.text(
    `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | Turno: ${currentClass.shift}${teacherInfo} | Aulas Dadas (Ministradas): ${totalLessonsTaught} | Aulas Planejadas: ${totalLessonsPlanned} | Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
    textX,
    currentY
  );

  // Separator rule (clean light line, no black blocks)
  const actualSepY = Math.max(currentY + 3.5, logoH > 0 ? 6 + logoH + 2.5 : 24);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, actualSepY, pageWidth - 14, actualSepY);

  // SECTION 1: ATTENDANCE TABLE (CHAMADA)
  const sec1TitleY = actualSepY + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('1. REGISTRO DE FREQUÊNCIA E CHAMADA DOS ALUNOS', 14, sec1TitleY);

  const maxDateCols = Math.min(lessonDates.length, 18);
  const displayedDates = lessonDates.slice(0, maxDateCols);

  const attendanceHead = [
    [
      'Nº',
      'Nome do Estudante',
      ...displayedDates.map(d => {
        const parts = d.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
      }),
      'Faltas',
      'Freq. %'
    ]
  ];

  const attendanceBody = activeStudents.map(student => {
    const studentAtts = attendances.filter(a => a.studentId === student.id && a.classId === currentClass.id);
    
    // Total classes and absences
    const totalPossible = displayedDates.length || 1;
    let absences = 0;

    const dateStatuses = displayedDates.map(dateStr => {
      const rec = studentAtts.find(a => a.date === dateStr);
      if (!rec) return '—';
      if (rec.status === 'present') return 'P';
      if (rec.status === 'absent') {
        absences++;
        return 'F';
      }
      return 'J';
    });

    const attendanceRate = Math.max(0, Math.round(((totalPossible - absences) / totalPossible) * 100));

    return [
      String(student.rollNumber).padStart(2, '0'),
      student.name,
      ...dateStatuses,
      String(absences),
      `${attendanceRate}%`
    ];
  });

  const faltasColIdx = 2 + displayedDates.length;
  const freqColIdx = 3 + displayedDates.length;

  const totalTableWidth = pageWidth - 28; // 297mm - 28mm = 269mm
  const rollWidth = 10;
  const dateColWidth = 7;
  const datesTotalWidth = displayedDates.length * dateColWidth;
  const faltasWidth = 15;
  const freqWidth = 16;
  const studentNameWidth = Math.max(70, totalTableWidth - rollWidth - datesTotalWidth - faltasWidth - freqWidth);

  autoTable(doc, {
    head: attendanceHead,
    body: attendanceBody,
    startY: sec1TitleY + 3,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      font: 'helvetica',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.2,
      lineColor: [203, 213, 225]
    },
    columnStyles: {
      0: { cellWidth: rollWidth, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: studentNameWidth },
      ...displayedDates.reduce((acc: any, _, idx) => {
        acc[idx + 2] = { cellWidth: dateColWidth, halign: 'center' };
        return acc;
      }, {}),
      [faltasColIdx]: { cellWidth: faltasWidth, halign: 'center' },
      [freqColIdx]: { cellWidth: freqWidth, halign: 'center', fontStyle: 'bold' }
    }
  });

  // PAGE 1: STATISTICAL SUMMARY STRIP AT THE BOTTOM (TOTAL DE AULAS NO FIM DA PÁGINA)
  const tableBottomY = (doc as any).lastAutoTable.finalY;
  const overallAvgAttendance = activeStudents.length > 0
    ? Math.round(
        activeStudents.reduce((sum, s) => {
          const sAtts = attendances.filter(a => a.studentId === s.id && a.classId === currentClass.id);
          const totalP = displayedDates.length || 1;
          const abs = displayedDates.filter(d => sAtts.find(a => a.date === d)?.status === 'absent').length;
          return sum + Math.round(((totalP - abs) / totalP) * 100);
        }, 0) / activeStudents.length
      )
    : 100;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, tableBottomY + 3, pageWidth - 28, 7.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(
    `AULAS DADAS (MINISTRADAS): ${totalLessonsTaught}   |   AULAS PLANEJADAS: ${totalLessonsPlanned}   |   FREQUÊNCIA MÉDIA DA TURMA: ${overallAvgAttendance}%   |   TOTAL DE ALUNOS: ${activeStudents.length}`,
    pageWidth / 2,
    tableBottomY + 7.8,
    { align: 'center' }
  );

  // PAGE 1: SIGNATURES & VALIDATION (FOLHA 1: CHAMADA)
  const page1FinalY = tableBottomY + 14;
  if (page1FinalY < 185) {
    const leftX = 40;
    const rightX = 175;
    const lineWidth = 80;

    doc.setDrawColor(180, 180, 180);
    doc.line(leftX, page1FinalY + 5, leftX + lineWidth, page1FinalY + 5);
    doc.line(rightX, page1FinalY + 5, rightX + lineWidth, page1FinalY + 5);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(options?.teacherName || 'Professor(a) Responsável', leftX + lineWidth / 2, page1FinalY + 9, { align: 'center' });
    doc.text('Visto da Coordenação Pedagógica / Direção', rightX + lineWidth / 2, page1FinalY + 9, { align: 'center' });
  }

  // Page 1 Footer indicator
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Diário de Classe Oficial — Folha 1: Registro de Frequência e Chamada dos Alunos', 14, 202);
  doc.text('Página 1 de 2', 283, 202, { align: 'right' });

  // =========================================================================
  // ITEM 2: START ON PAGE 2 (FOLHA 2: CONTEÚDOS MINISTRADOS)
  // =========================================================================
  doc.addPage('a4', 'landscape');

  // Page 2 Clean Header
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 28, 'F');

  let page2TextX = 14;
  let page2LogoH = 0;
  if (activeLogo) {
    const logoRes = drawSchoolLogoInPDF(doc, activeLogo, 14, 6, 17, 17);
    if (logoRes.width > 0) {
      page2TextX = 14 + logoRes.width + 4;
      page2LogoH = logoRes.height;
    }
  }

  let page2Y = 9.5;
  if (activeSchoolName && activeSchoolName.trim()) {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(activeSchoolName.trim().toUpperCase(), page2TextX, page2Y);
    page2Y += 5;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`DIÁRIO DE CLASSE: CONTEÚDOS MINISTRADOS E REGISTRO DE AULAS — ${termLabel.toUpperCase()}`, page2TextX, page2Y);

  page2Y += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | Turno: ${currentClass.shift}${teacherInfo} | Aulas Dadas (Ministradas): ${totalLessonsTaught} | Aulas Planejadas: ${totalLessonsPlanned} | Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
    page2TextX,
    page2Y
  );

  // Separator rule for Page 2
  const page2SepY = Math.max(page2Y + 3.5, page2LogoH > 0 ? 6 + page2LogoH + 2.5 : 24);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, page2SepY, pageWidth - 14, page2SepY);

  // SECTION 2 TITLE
  const sec2TitleY = page2SepY + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('2. DIÁRIO DE CONTEÚDOS MINISTRADOS E REGISTRO DE AULAS', 14, sec2TitleY);

  const lessonsHead = [
    ['Data', 'Aulas', 'Objeto do Conhecimento / Tópico', 'Conteúdo Programático Desenvolvido', 'Habilidade BNCC', 'Tarefa / Metodologia', 'Status']
  ];

  const lessonsBody = classLessons.map(l => {
    const parts = l.date.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : l.date;

    return [
      formattedDate,
      String(l.lessonCount || 1),
      l.topic || '—',
      l.contentDescription || '—',
      l.bnccSkills || '—',
      l.homework || 'Atividades em sala',
      l.status === 'dado' ? 'Realizada' : 'Planejada'
    ];
  });

  if (lessonsBody.length === 0) {
    lessonsBody.push(['—', '—', 'Nenhum conteúdo registrado para este período.', '—', '—', '—', '—']);
  }

  const lessonsFoot = [
    [
      'TOTAL',
      String(totalLessonsTaught),
      `Aulas Dadas (Ministradas): ${totalLessonsTaught}   |   Aulas Planejadas (Previstas): ${totalLessonsPlanned}`,
      '',
      '',
      '',
      `${totalLessonsTaught} Dadas`
    ]
  ];

  autoTable(doc, {
    head: lessonsHead,
    body: lessonsBody,
    foot: lessonsFoot,
    startY: sec2TitleY + 3,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.2,
      lineColor: [203, 213, 225]
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.2,
      lineColor: [203, 213, 225]
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 50 },
      3: { cellWidth: 80 },
      4: { cellWidth: 35 },
      5: { cellWidth: 45 },
      6: { cellWidth: 22, halign: 'center' }
    }
  });

  // Summary strip on page 2
  const page2TableBottom = (doc as any).lastAutoTable.finalY;
  if (page2TableBottom + 26 < 200) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, page2TableBottom + 3, pageWidth - 28, 7.5, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(
      `TOTAL DE AULAS DADAS (MINISTRADAS): ${totalLessonsTaught}   |   TOTAL DE AULAS PLANEJADAS (PREVISTAS): ${totalLessonsPlanned}   |   REGISTROS: ${classLessons.length}`,
      pageWidth / 2,
      page2TableBottom + 7.8,
      { align: 'center' }
    );
  }

  // PAGE 2: SIGNATURES & VALIDATION (FOLHA 2: CONTEÚDOS)
  const page2FinalY = (doc as any).lastAutoTable.finalY + 15;
  if (page2FinalY < 185) {
    const leftX = 40;
    const rightX = 175;
    const lineWidth = 80;

    doc.setDrawColor(180, 180, 180);
    doc.line(leftX, page2FinalY + 5, leftX + lineWidth, page2FinalY + 5);
    doc.line(rightX, page2FinalY + 5, rightX + lineWidth, page2FinalY + 5);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(options?.teacherName || 'Professor(a) Responsável', leftX + lineWidth / 2, page2FinalY + 9, { align: 'center' });
    doc.text('Visto da Coordenação Pedagógica / Direção', rightX + lineWidth / 2, page2FinalY + 9, { align: 'center' });
  }

  // Page 2 Footer indicator
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Diário de Classe Oficial — Folha 2: Registro de Conteúdos Curriculares Ministrados', 14, 202);
  doc.text('Página 2 de 2', 283, 202, { align: 'right' });

  const filename = `Diario_Chamada_Conteudos_${currentClass.name.replace(/\s+/g, '_')}_${termLabel.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads Occurrences PDF (Relatório de Ocorrências por Data / Turma)
 */
export function generateIncidentsPDF(
  currentClass: ClassRoom,
  students: Student[],
  incidents: StudentIncident[],
  filterDate?: string,
  incidentTypes?: IncidentTypeDefinition[],
  options?: {
    schoolName?: string;
    schoolLogo?: string | null;
    includeLogo?: boolean;
  }
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const classIncidents = incidents
    .filter(inc => inc.classId === currentClass.id && (!filterDate || inc.date === filterDate))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const shouldIncludeLogo = options?.includeLogo !== undefined ? options.includeLogo : getIncludeSchoolLogoPreference();
  const activeLogo = shouldIncludeLogo ? (options?.schoolLogo !== undefined ? options.schoolLogo : getSchoolLogo()) : null;
  const activeSchoolName = options?.schoolName || getSchoolName();

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 26, 'F');

  let textX = 14;
  if (activeLogo) {
    const logoRes = drawSchoolLogoInPDF(doc, activeLogo, 14, 4, 18, 18);
    if (logoRes.width > 0) {
      textX = 14 + logoRes.width + 4;
    }
  }

  let textY = 8.5;
  if (activeSchoolName) {
    doc.setTextColor(251, 191, 36); // Amber-400
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(activeSchoolName.toUpperCase(), textX, textY);
    textY += 4.5;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('LIVRO DE OCORRÊNCIAS DISCIPLINARES & PEDAGÓGICAS', textX, textY);

  textY += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const dateInfo = filterDate ? `Data: ${filterDate.split('-').reverse().join('/')}` : 'Todas as datas';
  doc.text(
    `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | ${dateInfo} | Total: ${classIncidents.length} Registros`,
    textX,
    textY
  );

  const head = [['Data', 'Estudante', 'Tipo / Título', 'Descrição & Providências Adotadas', 'Família']];

  const defaultTypeLabels: Record<string, string> = {
    comportamento: 'Comportamento',
    pedagogica: 'Pedagógica',
    atraso: 'Atraso',
    tarefa: 'Falta Tarefa',
    material: 'Falta Material',
    elogio: 'Elogio',
    comunicacao_responsavel: 'Comunicação',
    outro: 'Outro'
  };

  const body = classIncidents.map(inc => {
    const student = students.find(s => s.id === inc.studentId);
    const studentName = student ? `Nº ${String(student.rollNumber).padStart(2, '0')} - ${student.name}` : 'Estudante não identificado';
    const dateFormatted = inc.date ? inc.date.split('-').reverse().join('/') : '—';
    const customDef = incidentTypes?.find(t => t.id === inc.type);
    const typeLabel = customDef?.label || defaultTypeLabels[inc.type] || inc.type;

    let descText = inc.description;
    if (inc.actionTaken) {
      descText += `\n\nProvidência: ${inc.actionTaken}`;
    }

    return [
      dateFormatted,
      studentName,
      `${typeLabel}\n\n${inc.title}`,
      descText,
      inc.notifiedGuardian ? 'Notificado' : 'Não'
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: activeLogo ? 32 : 30,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      font: 'helvetica',
      valign: 'top'
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 70 },
      4: { cellWidth: 18, halign: 'center' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 16;
  if (finalY < 270) {
    doc.setDrawColor(180, 180, 180);
    doc.line(20, finalY, 90, finalY);
    doc.line(120, finalY, 190, finalY);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Professor(a) Registrante', 55, finalY + 4, { align: 'center' });
    doc.text('Visto da Orientação / Direção', 155, finalY + 4, { align: 'center' });
  }

  const filename = `Ocorrencias_${currentClass.name.replace(/\s+/g, '_')}_${filterDate || 'Geral'}.pdf`;
  doc.save(filename);
}

export function generateBookCorrectionReportPDF(options: {
  currentClass: ClassRoom;
  academicYearTitle: string;
  students: Student[];
  assignment: BookAssignment;
  checks: StudentBookCheck[];
  schoolLogoOption?: {
    includeLogo?: boolean;
    schoolLogo?: string | null;
    schoolName?: string;
  };
}) {
  const { currentClass, academicYearTitle, students, assignment, checks, schoolLogoOption } = options;
  const doc = new jsPDF('p', 'mm', 'a4');

  const prefIncludeLogo = schoolLogoOption?.includeLogo ?? getIncludeSchoolLogoPreference();
  const activeLogo = prefIncludeLogo ? (schoolLogoOption?.schoolLogo ?? getSchoolLogo()) : null;
  const activeSchoolName = (schoolLogoOption?.schoolName?.trim() || getSchoolName()).toUpperCase();

  let startX = 14;
  if (activeLogo) {
    const { width: drawnW } = drawSchoolLogoInPDF(doc, activeLogo, 14, 8, 16, 16);
    startX = 14 + (drawnW > 0 ? drawnW + 4 : 0);
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(activeSchoolName, startX, 12);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('CONTROLE DE CORREÇÃO DE LIVROS & VISTOS', startX, 18);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Turma: ${currentClass.name} | Disciplina: ${currentClass.subject} | Ano: ${academicYearTitle} | ${getTermLabel(currentClass.termType, assignment.term)}`,
    startX,
    23
  );

  // Assignment details box with dynamic height for student instructions / observations
  const boxY = 27;
  const hasDesc = !!(assignment.description && assignment.description.trim());
  let descLines: string[] = [];
  let descBoxHeight = 0;

  if (hasDesc) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    // Wrap text to width 174 mm (182mm box width - 8mm internal margin)
    descLines = doc.splitTextToSize(assignment.description!.trim(), 174);
    // Title (4.5mm) + description lines (3.3mm per line) + padding
    descBoxHeight = 6 + (descLines.length * 3.3) + 3;
  }

  const totalBoxHeight = 16.5 + (hasDesc ? descBoxHeight : 0);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, boxY, 182, totalBoxHeight, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Material / Livro: ${assignment.bookTitle}`, 17, boxY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Etapa / Páginas: ${assignment.unitOrChapter} (${assignment.pages})`, 17, boxY + 9.5);

  const dateInfo = `Solicitado em: ${assignment.assignedDate.split('-').reverse().join('/')} | Data da Correção: ${assignment.dueDate.split('-').reverse().join('/')}`;
  doc.text(dateInfo, 17, boxY + 14);

  if (assignment.maxScore) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(`Pontuação Máxima: ${assignment.maxScore.toFixed(1)} pts`, 140, boxY + 14);
  }

  if (hasDesc) {
    // Subtle separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(17, boxY + 16, 193, boxY + 16);

    // Section title
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(67, 56, 202); // indigo-700
    doc.text('Orientações para os Alunos / Exercícios Específicos:', 17, boxY + 20.5);

    // Description text
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text(descLines, 17, boxY + 24.5);
  }

  const activeStudents = students
    .filter(s => s.classId === currentClass.id && s.status === 'active')
    .sort((a, b) => a.rollNumber - b.rollNumber);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'visto_completo': return 'Visto Completo (OK)';
      case 'incompleto': return 'Incompleto / Refazer';
      case 'nao_fez': return 'Não Fez / Não Entregue';
      case 'atrasado': return 'Entregue com Atraso';
      case 'justificado': return 'Justificado / Disp.';
      default: return 'Pendente';
    }
  };

  const body = activeStudents.map(s => {
    const chk = checks.find(c => c.studentId === s.id && c.bookAssignmentId === assignment.id);
    const statusText = chk ? getStatusLabel(chk.status) : 'Pendente';
    const scoreText = chk?.score !== undefined && chk?.score !== null ? chk.score.toFixed(1) : '—';
    const notesText = chk?.notes || '—';

    return [
      String(s.rollNumber).padStart(2, '0'),
      s.name,
      statusText,
      assignment.maxScore ? scoreText : '',
      notesText
    ];
  });

  const head = assignment.maxScore
    ? [['Nº', 'Nome do Estudante', 'Situação do Visto', 'Nota', 'Observações / Apontamentos']]
    : [['Nº', 'Nome do Estudante', 'Situação do Visto', '', 'Observações / Apontamentos']];

  autoTable(doc, {
    head,
    body,
    startY: boxY + totalBoxHeight + 3.5,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 60, fontStyle: 'bold' },
      2: { cellWidth: 38, halign: 'center' },
      3: assignment.maxScore ? { cellWidth: 16, halign: 'center' } : { cellWidth: 0 },
      4: { cellWidth: assignment.maxScore ? 56 : 72 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const txt = String(data.cell.raw);
        if (txt.includes('Completo')) {
          data.cell.styles.textColor = [16, 120, 72];
          data.cell.styles.fontStyle = 'bold';
        } else if (txt.includes('Incompleto')) {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
        } else if (txt.includes('Não Fez')) {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        } else if (txt.includes('Atraso')) {
          data.cell.styles.textColor = [124, 58, 237];
        }
      }
    }
  });

  // Calculate summary stats
  let totalChecked = 0;
  let totalComplete = 0;
  let totalIncomplete = 0;
  let totalNotDone = 0;

  activeStudents.forEach(s => {
    const chk = checks.find(c => c.studentId === s.id && c.bookAssignmentId === assignment.id);
    if (chk) {
      if (chk.status === 'visto_completo') {
        totalComplete++;
        totalChecked++;
      } else if (chk.status === 'incompleto') {
        totalIncomplete++;
        totalChecked++;
      } else if (chk.status === 'nao_fez') {
        totalNotDone++;
        totalChecked++;
      } else {
        totalChecked++;
      }
    }
  });

  const percentComplete = activeStudents.length > 0 ? Math.round((totalComplete / activeStudents.length) * 100) : 0;
  const lastY = (doc as any).lastAutoTable.finalY + 8;

  if (lastY < 265) {
    // Stats mini-banner
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, lastY, 182, 10, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Total de Alunos: ${activeStudents.length} | Vistos Completos: ${totalComplete} (${percentComplete}%) | Incompletos: ${totalIncomplete} | Não Fez: ${totalNotDone}`,
      17,
      lastY + 6.5
    );

    // Signatures
    const signY = lastY + 22;
    if (signY < 280) {
      doc.setDrawColor(180, 180, 180);
      doc.line(20, signY, 85, signY);
      doc.line(125, signY, 190, signY);

      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text('Professor(a) Responsável', 52.5, signY + 4, { align: 'center' });
      doc.text('Coordenação Pedagógica / Visto', 157.5, signY + 4, { align: 'center' });
    }
  }

  const cleanBookName = assignment.bookTitle.slice(0, 15).replace(/\s+/g, '_');
  const filename = `Correcao_Livro_${currentClass.name.replace(/\s+/g, '_')}_${cleanBookName}.pdf`;
  doc.save(filename);
}
