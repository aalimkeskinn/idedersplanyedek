import React, { useState, useRef } from 'react';
import { 
  Database, 
  Users, 
  Building, 
  BookOpen, 
  Calendar, 
  Trash2, 
  Plus, 
  Edit,
  AlertTriangle,
  BarChart3,
  Settings,
  Download,
  Upload,
  MapPin,
  FileText,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Link2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFirestore } from '../hooks/useFirestore';
import { useToast } from '../hooks/useToast';
import { useConfirmation } from '../hooks/useConfirmation';
import { Teacher, Class, Subject, Schedule, EDUCATION_LEVELS } from '../types';
import { parseComprehensiveCSV } from '../utils/csvParser';
import Button from '../components/UI/Button';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import Modal from '../components/UI/Modal';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

// Interfaces
interface ScheduleTemplate { id: string; name: string; }
interface Classroom { id: string; name: string; }
interface ParsedDataState {
  teachers: Partial<Teacher>[];
  classes: Partial<Class>[];
  subjects: Partial<Subject>[];
  classTeacherAssignments: Map<string, { classTeacherName: string | null; teacherNames: Set<string> }>;
}

const downloadCSV = (content: string, fileName: string) => {
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const DataManagement = () => {
  const navigate = useNavigate();
  const { data: teachers, remove: removeTeacher, add: addTeacher } = useFirestore<Teacher>('teachers');
  const { data: classes, remove: removeClass, add: addClass, update: updateClass } = useFirestore<Class>('classes');
  const { data: subjects, remove: removeSubject, add: addSubject } = useFirestore<Subject>('subjects');
  const { data: schedules, remove: removeSchedule } = useFirestore<Schedule>('schedules');
  const { data: templates, remove: removeTemplate } = useFirestore<ScheduleTemplate>('schedule-templates');
  const { data: classrooms, remove: removeClassroom } = useFirestore<Classroom>('classrooms');
  const { success, error, warning, info } = useToast();
  // DÜZELTME: confirmation ve hideConfirmation hook'tan doğru şekilde alındı.
  const { 
    confirmation, 
    hideConfirmation,
    confirmDelete 
  } = useConfirmation();

  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const comprehensiveFileInputRef = useRef<HTMLInputElement>(null);
  const [isComprehensiveCSVModalOpen, setIsComprehensiveCSVModalOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedDataState | null>(null);
  const [parsingErrors, setParsingErrors] = useState<string[]>([]);
  const [isImportingAll, setIsImportingAll] = useState(false);

  const handleComprehensiveCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) { error('❌ Dosya Hatası', 'Dosya içeriği okunamadı'); return; }

      try {
        const result = parseComprehensiveCSV(content);
        setParsedData({
          teachers: Array.from(result.teachers.values()),
          classes: Array.from(result.classes.values()),
          subjects: Array.from(result.subjects.values()),
          classTeacherAssignments: result.classTeacherAssignments,
        });
        setParsingErrors(result.errors);
        setIsComprehensiveCSVModalOpen(true);
      } catch (err) {
        console.error('Kapsamlı CSV işleme hatası:', err);
        error('❌ CSV Hatası', 'Dosya işlenirken beklenmedik bir hata oluştu.');
      } finally {
        if (comprehensiveFileInputRef.current) comprehensiveFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDownloadCSVTemplate = () => {
    const templateContent = `öğretmen adı;branş;eğitim seviyesi;ders Adı;sınıf ve şube;haftalık saat
"Öğretmen 1";"SINIF ÖĞRETMENLİĞİ";"İLKOKUL";"TÜRKÇE";"1A";"10"
"Öğretmen 1";"SINIF ÖĞRETMENLİĞİ";"İLKOKUL";"MATEMATİK";"1A";"5"
"Öğretmen 2";"SINIF ÖĞRETMENLİĞİ";"İLKOKUL";"TÜRKÇE";"1B";"10"
"Öğretmen 3";"İNGİLİZCE";"İLKOKUL";"İNGİLİZCE";"4A";"6"
"Öğretmen 3";"İNGİLİZCE";"İLKOKUL";"İNGİLİZCE";"5A";"6"
"Öğretmen 4";"MATEMATİK";"ORTAOKUL";"MATEMATİK";"5A";"5"
"Öğretmen 4";"MATEMATİK";"ORTAOKUL";"SEÇMELİ GEOMETRİ";"8A";"2"
"Öğretmen 5";"ANAOKULU ÖĞRETMENLİĞİ";"ANAOKULU";"SINIF ÖĞRETMENİ";"Papatyalar";"15"
"Öğretmen 6";"BEDEN EĞİTİMİ";"İLKOKUL";"BEDEN EĞİTİMİ";"4A";"2"
"Öğretmen 6";"BEDEN EĞİTİMİ";"ORTAOKUL";"BEDEN EĞİTİMİ";"8A";"2"
"Öğretmen 7";"FEN BİLİMLERİ";"ORTAOKUL";"FEN BİLİMLERİ";"5A";"4"
"Öğretmen 8";"SOSYAL BİLGİLER";"ORTAOKUL";"SOSYAL BİLGİLER";"5A";"3"
"Öğretmen 9";"GÖRSEL SANATLAR";"ANAOKULU";"GÖRSEL";"Papatyalar";"2"
"Öğretmen 9";"GÖRSEL SANATLAR";"İLKOKUL";"GÖRSEL";"2B";"2"
"Öğretmen 10";"İSPANYOLCA";"ORTAOKUL";"İSPANYOLCA";"7A";"2"
"Öğretmen 11";"ALMANCA";"ORTAOKUL";"ALMANCA";"7A";"2"
"Öğretmen 12";"BİLİŞİM TEKNOLOJİLERİ";"ORTAOKUL";"BİLİŞİM TEKNOLOJİLERİ";"7A";"2"
"Öğretmen 13";"REHBERLİK";"ORTAOKUL";"REHBERLİK";"8A";"1"
"Öğretmen 14";"DİN KÜLTÜRÜ";"ORTAOKUL";"DİN KÜLTÜRÜ";"8A";"2"`;

    downloadCSV(templateContent, 'kapsamli_veri_sablonu.csv');
    success('✅ Şablon İndirildi', 'CSV şablonu başarıyla indirildi');
  };

  const handleImportAllData = async () => {
    if (!parsedData) return;
    setIsImportingAll(true);
    info('Veri aktarımı başladı...', 'Lütfen bekleyin.');
  
    const { teachers: newTeachers, classes: newClasses, subjects: newSubjects, classTeacherAssignments } = parsedData;
    let addedCounts = { teachers: 0, classes: 0, subjects: 0, assignments: 0 };
    
    try {
        const batch = writeBatch(db);
        const teacherIdMap = new Map<string, string>();
        const classIdMap = new Map<string, string>();

        teachers.forEach(t => teacherIdMap.set(t.name.toLowerCase(), t.id));
        classes.forEach(c => classIdMap.set(c.name.toLowerCase(), c.id));
        
        newSubjects.forEach(subject => {
            if (!subjects.some(s => s.name.toLowerCase() === subject.name?.toLowerCase() && s.branch.toLowerCase() === subject.branch?.toLowerCase())) {
                const docRef = doc(collection(db, "subjects"));
                batch.set(docRef, { ...subject, createdAt: new Date() });
                addedCounts.subjects++;
            }
        });

        newClasses.forEach(classItem => {
            if (!classIdMap.has(classItem.name!.toLowerCase())) {
                const docRef = doc(collection(db, "classes"));
                batch.set(docRef, { ...classItem, createdAt: new Date() });
                classIdMap.set(classItem.name!.toLowerCase(), docRef.id);
                addedCounts.classes++;
            }
        });

        newTeachers.forEach(teacher => {
            if (!teacherIdMap.has(teacher.name!.toLowerCase())) {
                const docRef = doc(collection(db, "teachers"));
                batch.set(docRef, { ...teacher, createdAt: new Date() });
                teacherIdMap.set(teacher.name!.toLowerCase(), docRef.id);
                addedCounts.teachers++;
            }
        });
        
        for (const [rawClassName, assignment] of classTeacherAssignments.entries()) {
            const classNames = rawClassName.split('/').map(cn => cn.trim());

            for (const className of classNames) {
                const classId = classIdMap.get(className.toLowerCase());
                if (classId) {
                    const teacherIds = Array.from(assignment.teacherNames)
                        .map(name => teacherIdMap.get(name.toLowerCase()))
                        .filter((id): id is string => !!id);
                    
                    let classTeacherId: string | undefined = undefined;
                    if (assignment.classTeacherName) {
                        classTeacherId = teacherIdMap.get(assignment.classTeacherName.toLowerCase());
                    }
                    
                    const classRef = doc(db, "classes", classId);
                    
                    const updatePayload: { teacherIds: string[], classTeacherId?: string } = { teacherIds };
                    if (classTeacherId) {
                        updatePayload.classTeacherId = classTeacherId;
                    }

                    batch.update(classRef, updatePayload);
                    addedCounts.assignments++;
                } else {
                    console.warn(`İlişki kurulamadı: '${className}' sınıfı bulunamadı.`);
                }
            }
        }
        
        await batch.commit();

        success('✅ Aktarım Tamamlandı!', `${addedCounts.teachers} öğretmen, ${addedCounts.classes} sınıf, ${addedCounts.subjects} ders eklendi ve ${addedCounts.assignments} ilişki güncellendi.`);
    } catch (err) {
        error('❌ Aktarım Hatası', 'Veriler içe aktarılırken bir hata oluştu. Lütfen konsolu kontrol edin.');
        console.error(err);
    } finally {
        setIsImportingAll(false);
        setIsComprehensiveCSVModalOpen(false);
    }
  };

  const totalDataCount = teachers.length + classes.length + subjects.length + schedules.length + templates.length + classrooms.length;

  // DÜZELTME: Bu fonksiyon artık tanımlı ve butonlar tarafından kullanılabilir.
  const handleDeleteAllData = () => {
    const allItems = [
      ...teachers.map(item => ({ ...item, collection: 'teachers' })),
      ...classes.map(item => ({ ...item, collection: 'classes' })),
      ...subjects.map(item => ({ ...item, collection: 'subjects' })),
      ...schedules.map(item => ({ ...item, collection: 'schedules' })),
      ...templates.map(item => ({ ...item, collection: 'schedule-templates' })),
      ...classrooms.map(item => ({ ...item, collection: 'classrooms' })),
    ];

    if (allItems.length === 0) {
      warning('⚠️ Silinecek Veri Yok', 'Sistemde silinecek veri bulunamadı');
      return;
    }

    confirmDelete(
      `Tüm Veriler (${allItems.length} öğe)`,
      async () => {
        setIsDeletingAll(true);
        const batch = writeBatch(db);
        allItems.forEach(item => {
          batch.delete(doc(db, item.collection, item.id));
        });

        try {
          await batch.commit();
          success('🗑️ Tüm Veriler Silindi', `${allItems.length} öğe başarıyla sistemden kaldırıldı.`);
        } catch (err) {
          error('❌ Toplu Silme Hatası', 'Tüm veriler silinirken bir hata oluştu.');
        } finally {
          setIsDeletingAll(false);
        }
      }
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center">
                <Database className="w-8 h-8 text-purple-600 mr-3" />
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Veri Yönetimi</h1>
                    <p className="text-sm text-gray-600">Sistem verilerini yönetin ve temizleyin</p>
                </div>
            </div>
            <Button onClick={() => navigate('/')} variant="secondary">Ana Sayfaya Dön</Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center mb-4">
            <Zap className="w-6 h-6 text-yellow-500 mr-3" />
            <h2 className="text-lg font-bold text-gray-900">Akıllı Veri Yükleme</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Verilen CSV dosyasını tek seferde yükleyerek tüm öğretmen, sınıf ve ders verilerini sisteme otomatik olarak ekleyin.
            Sistem verileri ayrıştıracak ve tekrar edenleri birleştirecektir.
          </p>
          <div className="flex items-center space-x-3">
            <input
              type="file"
              accept=".csv"
              onChange={handleComprehensiveCSVUpload}
              ref={comprehensiveFileInputRef}
              className="hidden"
              id="comprehensive-csv-upload"
            />
            <Button onClick={() => comprehensiveFileInputRef.current?.click()} icon={Upload} variant="primary">Kapsamlı CSV Yükle</Button>
            <Button onClick={handleDownloadCSVTemplate} icon={Download} variant="secondary">Şablon İndir</Button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center"><BarChart3 className="w-6 h-6 text-purple-600 mr-2" /><h2 className="text-lg font-bold text-gray-900">Veri İstatistikleri</h2></div>
                <div className="text-sm text-gray-600">Toplam {totalDataCount} veri öğesi</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
                    <div className="flex flex-col items-center mb-4 text-center"><Users className="w-8 h-8 text-blue-600 mb-2" /><h3 className="text-base font-semibold text-blue-900 mb-1">Öğretmenler</h3><span className="text-3xl font-extrabold text-blue-700 mb-1">{teachers.length}</span></div>
                    <div className="flex flex-col w-full gap-2 mt-auto"><Button onClick={() => navigate('/teachers')} variant="secondary" size="md" className="w-full">Yönet</Button></div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
                    <div className="flex flex-col items-center mb-4 text-center"><Building className="w-8 h-8 text-emerald-600 mb-2" /><h3 className="text-base font-semibold text-emerald-900 mb-1">Sınıflar</h3><span className="text-3xl font-extrabold text-emerald-700 mb-1">{classes.length}</span></div>
                    <div className="flex flex-col w-full gap-2 mt-auto"><Button onClick={() => navigate('/classes')} variant="secondary" size="md" className="w-full">Yönet</Button></div>
                </div>
                <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
                    <div className="flex flex-col items-center mb-4 text-center"><BookOpen className="w-8 h-8 text-indigo-600 mb-2" /><h3 className="text-base font-semibold text-indigo-900 mb-1">Dersler</h3><span className="text-3xl font-extrabold text-indigo-700 mb-1">{subjects.length}</span></div>
                    <div className="flex flex-col w-full gap-2 mt-auto"><Button onClick={() => navigate('/subjects')} variant="secondary" size="md" className="w-full">Yönet</Button></div>
                </div>
                <div className="bg-teal-50 rounded-xl p-6 border border-teal-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
                    <div className="flex flex-col items-center mb-4 text-center"><MapPin className="w-8 h-8 text-teal-600 mb-2" /><h3 className="text-base font-semibold text-teal-900 mb-1">Derslikler</h3><span className="text-3xl font-extrabold text-teal-700 mb-1">{classrooms.length}</span></div>
                    <div className="flex flex-col w-full gap-3 mt-auto pt-2"><Button onClick={() => navigate('/classrooms')} variant="secondary" size="md" className="w-full">Yönet</Button></div>
                </div>
                <div className="bg-purple-50 rounded-xl p-6 border border-purple-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
                    <div className="flex flex-col items-center mb-4 text-center"><Calendar className="w-8 h-8 text-purple-600 mb-2" /><h3 className="text-base font-semibold text-purple-900 mb-1">Programlar</h3><span className="text-3xl font-extrabold text-purple-700 mb-1">{schedules.length}</span></div>
                    <div className="flex flex-col w-full gap-2 mt-auto"><Button onClick={() => navigate('/all-schedules')} variant="secondary" size="md" className="w-full">Yönet</Button></div>
                </div>
                <div className="bg-orange-50 rounded-xl p-6 border border-orange-200 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
                    <div className="flex flex-col items-center mb-4 text-center"><Settings className="w-8 h-8 text-orange-600 mb-2" /><h3 className="text-base font-semibold text-orange-900 mb-1">Şablonlar</h3><span className="text-3xl font-extrabold text-orange-700 mb-1">{templates.length}</span></div>
                    <div className="flex flex-col w-full gap-2 mt-auto"><Button onClick={() => navigate('/')} variant="secondary" size="md" className="w-full">Yönet</Button></div>
                </div>
            </div>
        </div>

        <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-6">
          <div className="flex items-center mb-6">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
            <h2 className="text-lg font-bold text-red-900">Tehlikeli Bölge</h2>
          </div>
          <div className="p-4 bg-white rounded-lg border border-red-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-red-900">Tüm Verileri Sil</h3>
                  <p className="text-sm text-red-700 mt-1">Bu işlem tüm verileri kalıcı olarak silecektir. Bu işlem geri alınamaz!</p>
                </div>
                <Button onClick={() => handleDeleteAllData()} icon={Trash2} variant="danger" disabled={isDeletingAll || totalDataCount === 0} className="w-full sm:w-auto flex-shrink-0">
                  {isDeletingAll ? 'Siliniyor...' : `Tüm Verileri Sil (${totalDataCount})`}
                </Button>
              </div>
            </div>
        </div>
      </div>

      <Modal isOpen={isComprehensiveCSVModalOpen} onClose={() => setIsComprehensiveCSVModalOpen(false)} title="Kapsamlı Veri İçe Aktarma Önizlemesi" size="xl">
        <div className="space-y-6">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800 mb-2">Ayrıştırma Sonucu</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-bold text-green-700">{parsedData?.teachers.length || 0}</p><p className="text-sm text-green-600">Benzersiz Öğretmen</p></div>
              <div><p className="text-2xl font-bold text-green-700">{parsedData?.classes.length || 0}</p><p className="text-sm text-green-600">Benzersiz Sınıf</p></div>
              <div><p className="text-2xl font-bold text-green-700">{parsedData?.subjects.length || 0}</p><p className="text-sm text-green-600">Benzersiz Ders</p></div>
              <div><p className="text-2xl font-bold text-green-700">{parsedData?.classTeacherAssignments.size || 0}</p><p className="text-sm text-green-600">Sınıf-Öğretmen İlişkisi</p></div>
            </div>
          </div>

          {parsingErrors.length > 0 && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-medium text-red-800 mb-2">Tespit Edilen Hatalar ({parsingErrors.length})</h4>
              <ul className="list-disc list-inside text-sm text-red-700 max-h-40 overflow-y-auto">
                {parsingErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-md font-semibold mb-2 flex items-center"><Link2 className="w-4 h-4 mr-2" />Sınıf-Öğretmen Atamaları Önizlemesi</h3>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2 text-left font-medium">Sınıf</th><th className="p-2 text-left font-medium">Sınıf Öğretmeni</th><th className="p-2 text-left font-medium">Derse Girecek Diğer Öğretmenler</th></tr></thead>
                <tbody>
                  {parsedData && Array.from(parsedData.classTeacherAssignments.entries()).map(([className, assignment], i) => (
                    <tr key={i} className="border-b"><td className="p-2 font-bold">{className}</td><td className="p-2 text-blue-600 font-medium">{assignment.classTeacherName || <span className='text-gray-400'>Belirtilmemiş</span>}</td><td className="p-2 text-gray-600">{Array.from(assignment.teacherNames).filter(t => t !== assignment.classTeacherName).join(', ')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" onClick={() => setIsComprehensiveCSVModalOpen(false)} variant="secondary">İptal</Button>
            <Button type="button" onClick={handleImportAllData} variant="primary" disabled={isImportingAll}>
              {isImportingAll ? 'Aktarılıyor...' : 'Verileri İçe Aktar'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal isOpen={confirmation.isOpen} onClose={hideConfirmation} onConfirm={confirmation.onConfirm} title={confirmation.title} message={confirmation.message} type={confirmation.type} confirmText={confirmation.confirmText} cancelText={confirmation.cancelText} confirmVariant={confirmation.confirmVariant} />
    </div>
  );
};

export default DataManagement;