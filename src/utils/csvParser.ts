// --- START OF FILE src/utils/csvParser.ts ---

import { Teacher, Class, Subject, EDUCATION_LEVELS } from '../types';

interface RawRow {
  teacherName: string;
  branch: string;
  level: 'Anaokulu' | 'İlkokul' | 'Ortaokul';
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

/**
 * CSV'den okunan eğitim seviyesi metnini standart bir formata dönüştürür.
 * Case-insensitive ve Türkçe karakterlere duyarsızdır.
 * @param level - CSV dosyasından okunan seviye metni (örn: "ilkokul", "İLKOKUL").
 * @returns Standartlaştırılmış seviye ('Anaokulu', 'İlkokul', 'Ortaokul') veya null.
 */
const normalizeLevel = (level: string): ('Anaokulu' | 'İlkokul' | 'Ortaokul') | null => {
    // KRİTİK DÜZELTME: 'İ' karakterinin doğru şekilde 'i' harfine dönüştürülmesi için
    // ve "İLOKUL", "ilkokul" gibi farklı yazımları yakalamak için
    // Türkçe'ye özgü küçük harfe çevirme fonksiyonu kullanıldı.
    const lowerLevel = level.trim().toLocaleLowerCase('tr-TR');
      
    if (lowerLevel.includes('anaokul')) return 'Anaokulu';
    if (lowerLevel.includes('ilkokul')) return 'İlkokul';
    if (lowerLevel.includes('ortaokul')) return 'Ortaokul';
    return null;
}

export const parseComprehensiveCSV = (csvContent: string): ParsedCSVData => {
  const teachers = new Map<string, Partial<Teacher>>();
  const classes = new Map<string, Partial<Class>>();
  const subjects = new Map<string, Partial<Subject>>();
  const classTeacherAssignments = new Map<string, { classTeacherName: string | null; teacherNames: Set<string> }>();
  const errors: string[] = [];

  const lines = csvContent.split('\n').filter(line => line.trim() && !line.startsWith(';'));
  const dataLines = lines.slice(1);

  dataLines.forEach((line, index) => {
    const cleanLine = line.replace(/^\uFEFF/, '').replace(/\r$/, '');
    const columns = cleanLine.split(';').map(col => col.trim().replace(/^"|"$/g, ''));
    
    const rawRow: Omit<RawRow, 'level'> & { level: string } = {
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
    
    const levels = rawRow.level.split('|').map(l => normalizeLevel(l.trim())).filter((l): l is 'Anaokulu' | 'İlkokul' | 'Ortaokul' => !!l);
    if (levels.length === 0) {
      errors.push(`${index + 2}. satırda geçersiz eğitim seviyesi: "${rawRow.level}"`);
      return;
    }
    
    const branches = rawRow.branch.split('|').map(b => b.trim());

    levels.forEach(level => {
      // --- Öğretmen Verisini Birleştir ---
      if (!teachers.has(rawRow.teacherName)) {
        teachers.set(rawRow.teacherName, { name: rawRow.teacherName, branches: new Set<string>(), levels: new Set<any>() });
      }
      const teacherEntry = teachers.get(rawRow.teacherName)!;
      branches.forEach(b => (teacherEntry.branches as Set<string>).add(b));
      (teacherEntry.levels as Set<any>).add(level);

      // --- Sınıf Verisini Birleştir ---
      const classNames = rawRow.className.split('/').map(cn => cn.trim());
      classNames.forEach(cn => {
        if (!classes.has(cn)) {
          classes.set(cn, { name: cn, level: level, levels: [level] });
        }
        const classEntry = classes.get(cn)!;
        const classLevels = new Set(classEntry.levels || [classEntry.level]);
        classLevels.add(level);
        classEntry.levels = Array.from(classLevels);

        if (!classTeacherAssignments.has(cn)) {
          classTeacherAssignments.set(cn, { classTeacherName: null, teacherNames: new Set<string>() });
        }
        const assignment = classTeacherAssignments.get(cn)!;
        assignment.teacherNames.add(rawRow.teacherName);
        if (rawRow.branch.toUpperCase().includes('SINIF ÖĞRETMENLİĞİ') && level !== 'Ortaokul') {
          assignment.classTeacherName = rawRow.teacherName;
        }
      });
      
      // *** KRİTİK DÜZELTME 3: DERS BİRLEŞTİRME MANTIĞI ***
      // Benzersiz anahtar artık SADECE ders adı ve branş. Haftalık saat, dersin bir özelliği değil,
      // dersin sınıfla olan ilişkisinin bir özelliğidir. Bu yüzden anahtardan çıkarıldı.
      const subjectKey = `${rawRow.subjectName.toLowerCase()}-${rawRow.branch.toLowerCase()}`;
      
      if (!subjects.has(subjectKey)) {
        // Eğer bu ders ilk defa görülüyorsa, yeni bir kayıt oluştur.
        // Haftalık saat, ilk karşılaşılan değer olarak varsayılan olarak atanır.
        // Bu değer daha sonra ders programı sihirbazında her sınıf için özel olarak ayarlanabilir.
        subjects.set(subjectKey, {
          name: rawRow.subjectName,
          branch: rawRow.branch,
          level: level, // İlk bulunan seviyeyi ana seviye yap (geriye uyumluluk için)
          levels: new Set([level]), // Seviyeleri bir Set içinde tutmaya başla
          weeklyHours: rawRow.weeklyHours || 1,
        });
      } else {
        // Eğer bu ders zaten mevcutsa, sadece yeni seviyeyi `levels` set'ine ekle.
        // Haftalık saatini GÜNCELLEMİYORUZ, çünkü bu artık dersin genel bir özelliği değil.
        const subjectEntry = subjects.get(subjectKey)!;
        (subjectEntry.levels as Set<any>).add(level);
      }
    });
  });

  // Son adımda Set'leri Array'e dönüştür
  teachers.forEach(teacher => {
    teacher.branches = Array.from(teacher.branches as Set<string>);
    teacher.levels = Array.from(teacher.levels as Set<any>);
    teacher.branch = (teacher.branches as string[])[0]; // Geriye uyumluluk için ilk branşı ata
    teacher.level = (teacher.levels as any[])[0]; // Geriye uyumluluk için ilk seviyeyi ata
  });

  classes.forEach(classItem => {
    classItem.levels = Array.from(classItem.levels as Set<any>);
    classItem.level = (classItem.levels as any[])[0]; // Geriye uyumluluk için ilk seviyeyi ata
  });

  subjects.forEach(subject => {
    subject.levels = Array.from(subject.levels as Set<any>);
    subject.level = (subject.levels as any[])[0]; // Geriye uyumluluk için ilk seviyeyi ata
  });

  return { 
    teachers, 
    classes, 
    subjects, 
    classTeacherAssignments, 
    errors 
  };
};
// --- END OF FILE src/utils/csvParser.ts ---