// --- START OF FILE src/utils/csvParser.ts ---

import { Teacher, Class, Subject, EDUCATION_LEVELS } from '../types';

interface RawRow {
  teacherName: string;
  branch: string;
  level: string;
  subjectName: string;
  className: string;
  weeklyHours: number;
}

export interface ParsedCSVData {
  teachers: Map<string, Partial<Teacher>>;
  classes: Map<string, Partial<Class>>;
  subjects: Map<string, Partial<Subject>>;
  classTeacherAssignments: Map<string, { classTeacherName: string | null; teacherNames: Set<string> }>;
  errors: string[];
}

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const parseComprehensiveCSV = (csvContent: string): ParsedCSVData => {
  const teachers = new Map<string, Partial<Teacher>>();
  const classes = new Map<string, Partial<Class>>();
  const subjects = new Map<string, Partial<Subject>>();
  const classTeacherAssignments = new Map<string, { classTeacherName: string | null; teacherNames: Set<string> }>();
  const errors: string[] = [];

  const lines = csvContent.split('\n').filter(line => line.trim() && !line.startsWith(';'));
  const dataLines = lines.slice(1);

  dataLines.forEach((line, index) => {
    const cleanLine = line.replace(/^\uFEFF/, '');
    const columns = cleanLine.split(';').map(col => col.trim().replace(/^"|"$/g, ''));
    
    const rawRow: RawRow = {
      teacherName: columns[0]?.trim() || '',
      branch: columns[1]?.trim() || '',
      level: columns[2]?.trim() || '',
      subjectName: columns[3]?.trim() || '',
      className: columns[4]?.trim() || '',
      weeklyHours: parseInt(columns[5] || '0', 10),
    };

    if (!rawRow.teacherName || !rawRow.branch || !rawRow.level || !rawRow.subjectName || !rawRow.className) {
      if(line.trim()) { errors.push(`${index + 2}. satırda eksik veri: ${line}`); }
      return;
    }
    
    const normalizedLevel = toTitleCase(rawRow.level);
    if (!EDUCATION_LEVELS.includes(normalizedLevel as any)) {
      errors.push(`${index + 2}. satırda geçersiz eğitim seviyesi: "${rawRow.level}"`);
      return;
    }
    const level = normalizedLevel as 'Anaokulu' | 'İlkokul' | 'Ortaokul';

    if (!teachers.has(rawRow.teacherName)) {
      teachers.set(rawRow.teacherName, { name: rawRow.teacherName, branches: new Set<string>(), levels: new Set<any>() });
    }
    const teacherEntry = teachers.get(rawRow.teacherName)!;
    (teacherEntry.branches as Set<string>).add(rawRow.branch);
    (teacherEntry.levels as Set<any>).add(level);

    if (!classes.has(rawRow.className)) {
      classes.set(rawRow.className, { name: rawRow.className, level: level, levels: new Set<any>() });
    }
    const classEntry = classes.get(rawRow.className)!;
    (classEntry.levels as Set<any>).add(level);

    const subjectKey = `${rawRow.subjectName}-${rawRow.branch}-${level}`;
    if (!subjects.has(subjectKey)) {
      subjects.set(subjectKey, { name: rawRow.subjectName, branch: rawRow.branch, level: level, levels: [level], weeklyHours: rawRow.weeklyHours });
    }

    if (!classTeacherAssignments.has(rawRow.className)) {
      classTeacherAssignments.set(rawRow.className, { classTeacherName: null, teacherNames: new Set<string>() });
    }
    const assignment = classTeacherAssignments.get(rawRow.className)!;
    assignment.teacherNames.add(rawRow.teacherName);

    // GÜNCELLENDİ: Ortaokul seviyesi için sınıf öğretmenliği atanmaz.
    if (rawRow.branch.toUpperCase() === 'SINIF ÖĞRETMENLİĞİ' && level !== 'Ortaokul') {
      assignment.classTeacherName = rawRow.teacherName;
    }
  });

  teachers.forEach(teacher => {
    teacher.branches = Array.from(teacher.branches as Set<string>);
    teacher.levels = Array.from(teacher.levels as Set<any>);
    teacher.branch = (teacher.branches as string[]).join(', ');
    teacher.level = (teacher.levels as any[])[0];
  });

  classes.forEach(classItem => {
    classItem.levels = Array.from(classItem.levels as Set<any>);
    classItem.level = (classItem.levels as any[])[0];
  });

  return { teachers, classes, subjects, classTeacherAssignments, errors };
};
