import { Teacher, Class, Subject } from '../types';
import { WizardData, SubjectTeacherMapping } from '../types/wizard';

/**
 * Belirli bir ders ve sınıf için en uygun öğretmeni bulur.
 * Öncelik sırası: Sınıfa özel atanmış öğretmenler -> Diğer uygun öğretmenler.
 */
function findSuitableTeacher(subject: Subject, classItem: Class, availableTeachers: Teacher[]): Teacher | null {
  // Öncelik 1: Sınıfın kendi öğretmenlerinden (sınıf öğretmeni vb.) branşı ve seviyesi tutan
  const primaryTeacher = availableTeachers.find(t =>
    (classItem.teacherIds?.includes(t.id) || classItem.classTeacherId === t.id) &&
    t.branch === subject.branch &&
    t.level === subject.level
  );
  if (primaryTeacher) return primaryTeacher;

  // Öncelik 2: Diğer öğretmenler arasından branşı ve seviyesi tutan
  const secondaryTeacher = availableTeachers.find(t =>
    t.branch === subject.branch &&
    t.level === subject.level
  );
  if (secondaryTeacher) return secondaryTeacher;

  // Bulunamadıysa null döner
  return null;
}

/**
 * Sihirbaz verilerini kullanarak ders-öğretmen-sınıf eşleştirmelerini oluşturur.
 * Bu, programlama algoritmasının "görev listesidir".
 * @returns Oluşturulan eşleştirmeler ve planlama sırasında oluşan hatalar.
 */
export function createSubjectTeacherMappings(
  wizardData: WizardData,
  allTeachers: Teacher[],
  allClasses: Class[],
  allSubjects: Subject[]): { mappings: SubjectTeacherMapping[], errors: string[] } {
  const mappings: SubjectTeacherMapping[] = [];
  const errors: string[] = [];

  // Kullanıcının sihirbazda seçtiği verileri filtrele
  const selectedClasses = allClasses.filter(c => wizardData.classes.selectedClasses.includes(c.id));
  const selectedSubjects = allSubjects.filter(s => wizardData.subjects.selectedSubjects.includes(s.id));
  const selectedTeachers = allTeachers.filter(t => wizardData.teachers.selectedTeachers.includes(t.id));

  // Her seçili sınıf ve ders için bir eşleştirme oluşturmaya çalış
  for (const classItem of selectedClasses) {
    for (const subject of selectedSubjects) {
      // Sadece aynı seviyedeki dersleri işle (örn. İlkokul sınıfına lise dersi atama)
      if (classItem.level !== subject.level) {
        console.warn(`⚠️ Seviye uyumsuzluğu: Sınıf '${classItem.name}' (Seviye: ${classItem.level}) ile Ders '${subject.name}' (Seviye: ${subject.level}). Bu ders atlanıyor.`);
        continue; // Bu dersi bu sınıfa atlamalıyız
      }

      const suitableTeacher = findSuitableTeacher(subject, classItem, selectedTeachers);

      if (suitableTeacher) {
        mappings.push({
          id: `${classItem.id}-${subject.id}-${suitableTeacher.id}`, // Benzersiz ID için teacherId eklendi
          classId: classItem.id,
          className: classItem.name, // Eklendi
          subjectId: subject.id,
          subjectName: subject.name, // Eklendi
          teacherId: suitableTeacher.id,
          teacherName: suitableTeacher.name, // Eklendi
          weeklyHours: wizardData.subjects.subjectHours[subject.id] || subject.weeklyHours,
          assignedHours: 0,
          priority: wizardData.subjects.subjectPriorities[subject.id] || 'medium',
        });
      } else {
        // Eğer bir ders için uygun öğretmen bulunamazsa, bu kritik bir hatadır.
        errors.push(`'${classItem.name}' sınıfı için "${subject.name}" dersine uygun öğretmen bulunamadı. Lütfen yeterli sayıda öğretmen seçtiğinizden ve branş/seviye uyumluluklarını kontrol ettiğinizden emin olun.`);
      }
    }
  }
  return { mappings, errors };
}