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
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFirestore } from '../hooks/useFirestore';
import { useToast } from '../hooks/useToast';
import { useConfirmation } from '../hooks/useConfirmation';
import { Teacher, Class, Subject, Schedule, EDUCATION_LEVELS } from '../types';
import Button from '../components/UI/Button';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import Modal from '../components/UI/Modal';
import Select from '../components/UI/Select';

// Schedule Template interface
interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  academicYear: string;
  semester: string;
  wizardData: any;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'archived';
}

// Classroom interface
interface Classroom {
  id: string;
  name: string;
  type: string;
  capacity: number;
  floor: string;
  building: string;
  equipment: string[];
  shortName?: string;
  color?: string;
}

// CSV Teacher interface
interface CSVTeacher {
  name: string;
  branch: string;
  level: string;
  isValid: boolean;
  error?: string;
  exists?: boolean;
}

// CSV Subject interface
interface CSVSubject {
  name: string;
  branch: string;
  level: string;
  weeklyHours: number;
  isValid: boolean;
  error?: string;
  exists?: boolean;
}

const DataManagement = () => {
  const navigate = useNavigate();
  const { data: teachers, remove: removeTeacher, add: addTeacher } = useFirestore<Teacher>('teachers');
  const { data: classes, remove: removeClass } = useFirestore<Class>('classes');
  const { data: subjects, remove: removeSubject, add: addSubject } = useFirestore<Subject>('subjects');
  const { data: schedules, remove: removeSchedule } = useFirestore<Schedule>('schedules');
  const { data: templates, remove: removeTemplate } = useFirestore<ScheduleTemplate>('schedule-templates');
  const { data: classrooms, remove: removeClassroom } = useFirestore<Classroom>('classrooms');
  const { success, error, warning, info } = useToast();
  const { 
    confirmation, 
    showConfirmation, 
    hideConfirmation,
    confirmDelete 
  } = useConfirmation();

  const [isDeletingTeachers, setIsDeletingTeachers] = useState(false);
  const [isDeletingClasses, setIsDeletingClasses] = useState(false);
  const [isDeletingSubjects, setIsDeletingSubjects] = useState(false);
  const [isDeletingSchedules, setIsDeletingSchedules] = useState(false);
  const [isDeletingTemplates, setIsDeletingTemplates] = useState(false);
  const [isDeletingClassrooms, setIsDeletingClassrooms] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // CSV Import States
  const [isTeacherCSVModalOpen, setIsTeacherCSVModalOpen] = useState(false);
  const [isSubjectCSVModalOpen, setIsSubjectCSVModalOpen] = useState(false);
  const [csvTeachers, setCSVTeachers] = useState<CSVTeacher[]>([]);
  const [csvSubjects, setCSVSubjects] = useState<CSVSubject[]>([]);
  const [selectedTeacherLevel, setSelectedTeacherLevel] = useState('İlkokul');
  const [selectedSubjectLevel, setSelectedSubjectLevel] = useState('İlkokul');
  const [selectedSubjectHours, setSelectedSubjectHours] = useState('4');
  const [isImportingTeachers, setIsImportingTeachers] = useState(false);
  const [isImportingSubjects, setIsImportingSubjects] = useState(false);
  
  const teacherFileInputRef = useRef<HTMLInputElement>(null);
  const subjectFileInputRef = useRef<HTMLInputElement>(null);

  // Delete all teachers
  const handleDeleteAllTeachers = () => {
    if (teachers.length === 0) {
      warning('⚠️ Silinecek Öğretmen Yok', 'Sistemde silinecek öğretmen bulunamadı');
      return;
    }

    confirmDelete(
      `${teachers.length} Öğretmen`,
      async () => {
        setIsDeletingTeachers(true);
        
        try {
          let deletedCount = 0;
          
          for (const teacher of teachers) {
            try {
              await removeTeacher(teacher.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Öğretmen silinemedi: ${teacher.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Öğretmenler Silindi', `${deletedCount} öğretmen başarıyla silindi`);
          } else {
            error('❌ Silme Hatası', 'Hiçbir öğretmen silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Öğretmenler silinirken bir hata oluştu');
        } finally {
          setIsDeletingTeachers(false);
        }
      }
    );
  };

  // Delete all classes
  const handleDeleteAllClasses = () => {
    if (classes.length === 0) {
      warning('⚠️ Silinecek Sınıf Yok', 'Sistemde silinecek sınıf bulunamadı');
      return;
    }

    confirmDelete(
      `${classes.length} Sınıf`,
      async () => {
        setIsDeletingClasses(true);
        
        try {
          let deletedCount = 0;
          
          for (const classItem of classes) {
            try {
              await removeClass(classItem.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Sınıf silinemedi: ${classItem.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Sınıflar Silindi', `${deletedCount} sınıf başarıyla silindi`);
          } else {
            error('❌ Silme Hatası', 'Hiçbir sınıf silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Sınıflar silinirken bir hata oluştu');
        } finally {
          setIsDeletingClasses(false);
        }
      }
    );
  };

  // Delete all subjects
  const handleDeleteAllSubjects = () => {
    if (subjects.length === 0) {
      warning('⚠️ Silinecek Ders Yok', 'Sistemde silinecek ders bulunamadı');
      return;
    }

    confirmDelete(
      `${subjects.length} Ders`,
      async () => {
        setIsDeletingSubjects(true);
        
        try {
          let deletedCount = 0;
          
          for (const subject of subjects) {
            try {
              await removeSubject(subject.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Ders silinemedi: ${subject.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Dersler Silindi', `${deletedCount} ders başarıyla silindi`);
          } else {
            error('❌ Silme Hatası', 'Hiçbir ders silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Dersler silinirken bir hata oluştu');
        } finally {
          setIsDeletingSubjects(false);
        }
      }
    );
  };

  // Delete all schedules
  const handleDeleteAllSchedules = () => {
    if (schedules.length === 0) {
      warning('⚠️ Silinecek Program Yok', 'Sistemde silinecek program bulunamadı');
      return;
    }

    confirmDelete(
      `${schedules.length} Program`,
      async () => {
        setIsDeletingSchedules(true);
        
        try {
          let deletedCount = 0;
          
          for (const schedule of schedules) {
            try {
              await removeSchedule(schedule.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Program silinemedi: ${schedule.id}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Programlar Silindi', `${deletedCount} program başarıyla silindi`);
          } else {
            error('❌ Silme Hatası', 'Hiçbir program silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Programlar silinirken bir hata oluştu');
        } finally {
          setIsDeletingSchedules(false);
        }
      }
    );
  };

  // Delete all templates
  const handleDeleteAllTemplates = () => {
    if (templates.length === 0) {
      warning('⚠️ Silinecek Şablon Yok', 'Sistemde silinecek şablon bulunamadı');
      return;
    }

    confirmDelete(
      `${templates.length} Program Şablonu`,
      async () => {
        setIsDeletingTemplates(true);
        
        try {
          let deletedCount = 0;
          
          for (const template of templates) {
            try {
              await removeTemplate(template.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Şablon silinemedi: ${template.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Şablonlar Silindi', `${deletedCount} şablon başarıyla silindi`);
          } else {
            error('❌ Silme Hatası', 'Hiçbir şablon silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Şablonlar silinirken bir hata oluştu');
        } finally {
          setIsDeletingTemplates(false);
        }
      }
    );
  };

  // Delete all classrooms
  const handleDeleteAllClassrooms = () => {
    if (classrooms.length === 0) {
      warning('⚠️ Silinecek Derslik Yok', 'Sistemde silinecek derslik bulunamadı');
      return;
    }

    confirmDelete(
      `${classrooms.length} Derslik`,
      async () => {
        setIsDeletingClassrooms(true);
        
        try {
          let deletedCount = 0;
          
          for (const classroom of classrooms) {
            try {
              await removeClassroom(classroom.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Derslik silinemedi: ${classroom.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Derslikler Silindi', `${deletedCount} derslik başarıyla silindi`);
          } else {
            error('❌ Silme Hatası', 'Hiçbir derslik silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Derslikler silinirken bir hata oluştu');
        } finally {
          setIsDeletingClassrooms(false);
        }
      }
    );
  };

  // Delete all data
  const handleDeleteAllData = () => {
    const totalItems = teachers.length + classes.length + subjects.length + schedules.length + templates.length + classrooms.length;
    
    if (totalItems === 0) {
      warning('⚠️ Silinecek Veri Yok', 'Sistemde silinecek veri bulunamadı');
      return;
    }

    confirmDelete(
      `Tüm Veriler (${totalItems} öğe)`,
      async () => {
        setIsDeletingAll(true);
        
        try {
          let deletedCount = 0;
          
          // Delete schedules first
          for (const schedule of schedules) {
            try {
              await removeSchedule(schedule.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Program silinemedi: ${schedule.id}`, err);
            }
          }

          // Delete templates
          for (const template of templates) {
            try {
              await removeTemplate(template.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Şablon silinemedi: ${template.name}`, err);
            }
          }

          // Delete teachers
          for (const teacher of teachers) {
            try {
              await removeTeacher(teacher.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Öğretmen silinemedi: ${teacher.name}`, err);
            }
          }

          // Delete classes
          for (const classItem of classes) {
            try {
              await removeClass(classItem.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Sınıf silinemedi: ${classItem.name}`, err);
            }
          }

          // Delete subjects
          for (const subject of subjects) {
            try {
              await removeSubject(subject.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Ders silinemedi: ${subject.name}`, err);
            }
          }

          // Delete classrooms
          for (const classroom of classrooms) {
            try {
              await removeClassroom(classroom.id);
              deletedCount++;
            } catch (err) {
              console.error(`❌ Derslik silinemedi: ${classroom.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Tüm Veriler Silindi', `${deletedCount} öğe başarıyla silindi`);
          } else {
            error('❌ Silme Hatası', 'Hiçbir veri silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Veriler silinirken bir hata oluştu');
        } finally {
          setIsDeletingAll(false);
        }
      }
    );
  };

  // Edit template
  const handleEditTemplate = (templateId: string) => {
    navigate(`/schedule-wizard?templateId=${templateId}`);
  };

  // Delete template
  const handleDeleteTemplate = (template: ScheduleTemplate) => {
    confirmDelete(
      template.name,
      async () => {
        try {
          await removeTemplate(template.id);
          success('🗑️ Şablon Silindi', `${template.name} başarıyla silindi`);
        } catch (err) {
          error('❌ Silme Hatası', 'Şablon silinirken bir hata oluştu');
        }
      }
    );
  };

  // CSV Import Functions
  const handleTeacherCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        error('❌ Dosya Hatası', 'Dosya içeriği okunamadı');
        return;
      }

      try {
        // Parse CSV content
        const lines = content.split('\n').filter(line => line.trim());
        
        // Skip header line
        const dataLines = lines.slice(1);
        
        const parsedTeachers: CSVTeacher[] = dataLines.map(line => {
          // Split by comma or semicolon
          const columns = line.split(/[,;]/).map(col => col.trim().replace(/^"|"$/g, ''));
          
          // Assuming format: "Adı Soyadı", "Branşı", "Eğitim Seviyesi"
          const name = columns[0] || '';
          const branch = columns[1] || '';
          const level = columns[2] || '';
          
          // Validate data
          let isValid = true;
          let error = '';
          
          if (!name) {
            isValid = false;
            error = 'Ad Soyad boş olamaz';
          } else if (!branch) {
            isValid = false;
            error = 'Branş boş olamaz';
          } else if (level && !EDUCATION_LEVELS.includes(level as any)) {
            isValid = false;
            error = 'Geçersiz eğitim seviyesi';
          }
          
          // Check if teacher already exists
          const exists = teachers.some(t => 
            t.name.toLowerCase() === name.toLowerCase() && 
            t.branch.toLowerCase() === branch.toLowerCase()
          );
          
          return {
            name,
            branch,
            level: level || selectedTeacherLevel,
            isValid,
            error,
            exists
          };
        }).filter(teacher => teacher.name); // Filter out empty rows
        
        setCSVTeachers(parsedTeachers);
        setIsTeacherCSVModalOpen(true);
        
        // Reset file input
        if (teacherFileInputRef.current) {
          teacherFileInputRef.current.value = '';
        }
        
      } catch (err) {
        console.error('CSV parsing error:', err);
        error('❌ CSV Hatası', 'Dosya işlenirken bir hata oluştu');
      }
    };
    
    reader.readAsText(file);
  };

  const handleSubjectCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        error('❌ Dosya Hatası', 'Dosya içeriği okunamadı');
        return;
      }

      try {
        // Parse CSV content
        const lines = content.split('\n').filter(line => line.trim());
        
        // Skip header line
        const dataLines = lines.slice(1);
        
        const parsedSubjects: CSVSubject[] = dataLines.map(line => {
          // Split by comma or semicolon
          const columns = line.split(/[,;]/).map(col => col.trim().replace(/^"|"$/g, ''));
          
          // Assuming format: "Ders", "Branş", "Eğitim Seviyesi", "Ders Saati"
          const name = columns[0] || '';
          const branch = columns[1] || name; // Use name as branch if not provided
          const level = columns[2] || '';
          const weeklyHours = parseInt(columns[3] || selectedSubjectHours);
          
          // Validate data
          let isValid = true;
          let error = '';
          
          if (!name) {
            isValid = false;
            error = 'Ders adı boş olamaz';
          } else if (!branch) {
            isValid = false;
            error = 'Branş boş olamaz';
          } else if (level && !EDUCATION_LEVELS.includes(level as any)) {
            isValid = false;
            error = 'Geçersiz eğitim seviyesi';
          } else if (isNaN(weeklyHours) || weeklyHours < 1 || weeklyHours > 30) {
            isValid = false;
            error = 'Ders saati 1-30 arasında olmalıdır';
          }
          
          // Check if subject already exists
          const exists = subjects.some(s => 
            s.name.toLowerCase() === name.toLowerCase() && 
            s.level === (level || selectedSubjectLevel)
          );
          
          return {
            name,
            branch,
            level: level || selectedSubjectLevel,
            weeklyHours: isNaN(weeklyHours) ? parseInt(selectedSubjectHours) : weeklyHours,
            isValid,
            error,
            exists
          };
        }).filter(subject => subject.name); // Filter out empty rows
        
        setCSVSubjects(parsedSubjects);
        setIsSubjectCSVModalOpen(true);
        
        // Reset file input
        if (subjectFileInputRef.current) {
          subjectFileInputRef.current.value = '';
        }
        
      } catch (err) {
        console.error('CSV parsing error:', err);
        error('❌ CSV Hatası', 'Dosya işlenirken bir hata oluştu');
      }
    };
    
    reader.readAsText(file);
  };

  const handleImportTeachers = async () => {
    setIsImportingTeachers(true);
    
    try {
      const validTeachers = csvTeachers.filter(t => t.isValid && !t.exists);
      
      if (validTeachers.length === 0) {
        warning('⚠️ İçe Aktarılacak Veri Yok', 'Geçerli ve yeni öğretmen bulunamadı');
        setIsImportingTeachers(false);
        return;
      }
      
      let importedCount = 0;
      
      for (const teacher of validTeachers) {
        try {
          await addTeacher({
            name: teacher.name,
            branch: teacher.branch,
            level: teacher.level as 'Anaokulu' | 'İlkokul' | 'Ortaokul'
          });
          importedCount++;
        } catch (err) {
          console.error(`❌ Öğretmen eklenemedi: ${teacher.name}`, err);
        }
      }
      
      if (importedCount > 0) {
        success('✅ İçe Aktarma Başarılı', `${importedCount} öğretmen başarıyla içe aktarıldı`);
        setIsTeacherCSVModalOpen(false);
      } else {
        error('❌ İçe Aktarma Hatası', 'Hiçbir öğretmen içe aktarılamadı');
      }
    } catch (err) {
      console.error('❌ İçe aktarma hatası:', err);
      error('❌ İçe Aktarma Hatası', 'Öğretmenler içe aktarılırken bir hata oluştu');
    } finally {
      setIsImportingTeachers(false);
    }
  };

  const handleImportSubjects = async () => {
    setIsImportingSubjects(true);
    
    try {
      const validSubjects = csvSubjects.filter(s => s.isValid && !s.exists);
      
      if (validSubjects.length === 0) {
        warning('⚠️ İçe Aktarılacak Veri Yok', 'Geçerli ve yeni ders bulunamadı');
        setIsImportingSubjects(false);
        return;
      }
      
      let importedCount = 0;
      
      for (const subject of validSubjects) {
        try {
          await addSubject({
            name: subject.name,
            branch: subject.branch,
            level: subject.level as 'Anaokulu' | 'İlkokul' | 'Ortaokul',
            weeklyHours: subject.weeklyHours
          });
          importedCount++;
        } catch (err) {
          console.error(`❌ Ders eklenemedi: ${subject.name}`, err);
        }
      }
      
      if (importedCount > 0) {
        success('✅ İçe Aktarma Başarılı', `${importedCount} ders başarıyla içe aktarıldı`);
        setIsSubjectCSVModalOpen(false);
      } else {
        error('❌ İçe Aktarma Hatası', 'Hiçbir ders içe aktarılamadı');
      }
    } catch (err) {
      console.error('❌ İçe aktarma hatası:', err);
      error('❌ İçe Aktarma Hatası', 'Dersler içe aktarılırken bir hata oluştu');
    } finally {
      setIsImportingSubjects(false);
    }
  };

  const totalDataCount = teachers.length + classes.length + subjects.length + schedules.length + templates.length + classrooms.length;
  const sortedTemplates = [...templates].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Database className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Veri Yönetimi</h1>
                <p className="text-sm text-gray-600">Sistem verilerini yönetin ve temizleyin</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate('/')}
                variant="secondary"
              >
                Ana Sayfaya Dön
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <BarChart3 className="w-6 h-6 text-purple-600 mr-2" />
              <h2 className="text-lg font-bold text-gray-900">Veri İstatistikleri</h2>
            </div>
            <div className="text-sm text-gray-600">
              Toplam {totalDataCount} veri öğesi
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {/* Öğretmenler */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
              <div className="flex flex-col items-center mb-4">
                <Users className="w-8 h-8 text-blue-600 mb-2" />
                <h3 className="text-base font-semibold text-blue-900 mb-1">Öğretmenler</h3>
                <span className="text-3xl font-extrabold text-blue-700 mb-1">{teachers.length}</span>
                <p className="text-xs text-blue-700">Öğretmen kayıtları</p>
              </div>
              <div className="flex flex-col w-full gap-2 mt-auto">
                <Button
                  onClick={() => navigate('/teachers')}
                  variant="secondary"
                  size="md"
                  className="w-full"
                >
                  Yönet
                </Button>
                {teachers.length > 0 && (
                  <Button
                    onClick={handleDeleteAllTeachers}
                    icon={Trash2}
                    variant="danger"
                    size="md"
                    disabled={isDeletingTeachers}
                    className="w-full"
                  >
                    {isDeletingTeachers ? 'Siliniyor...' : 'Tümünü Sil'}
                  </Button>
                )}
              </div>
            </div>
            {/* Sınıflar */}
            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
              <div className="flex flex-col items-center mb-4">
                <Building className="w-8 h-8 text-emerald-600 mb-2" />
                <h3 className="text-base font-semibold text-emerald-900 mb-1">Sınıflar</h3>
                <span className="text-3xl font-extrabold text-emerald-700 mb-1">{classes.length}</span>
                <p className="text-xs text-emerald-700">Sınıf kayıtları</p>
              </div>
              <div className="flex flex-col w-full gap-2 mt-auto">
                <Button
                  onClick={() => navigate('/classes')}
                  variant="secondary"
                  size="md"
                  className="w-full"
                >
                  Yönet
                </Button>
                {classes.length > 0 && (
                  <Button
                    onClick={handleDeleteAllClasses}
                    icon={Trash2}
                    variant="danger"
                    size="md"
                    disabled={isDeletingClasses}
                    className="w-full"
                  >
                    {isDeletingClasses ? 'Siliniyor...' : 'Tümünü Sil'}
                  </Button>
                )}
              </div>
            </div>
            {/* Dersler */}
            <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
              <div className="flex flex-col items-center mb-4">
                <BookOpen className="w-8 h-8 text-indigo-600 mb-2" />
                <h3 className="text-base font-semibold text-indigo-900 mb-1">Dersler</h3>
                <span className="text-3xl font-extrabold text-indigo-700 mb-1">{subjects.length}</span>
                <p className="text-xs text-indigo-700">Ders kayıtları</p>
              </div>
              <div className="flex flex-col w-full gap-2 mt-auto">
                <Button
                  onClick={() => navigate('/subjects')}
                  variant="secondary"
                  size="md"
                  className="w-full"
                >
                  Yönet
                </Button>
                {subjects.length > 0 && (
                  <Button
                    onClick={handleDeleteAllSubjects}
                    icon={Trash2}
                    variant="danger"
                    size="md"
                    disabled={isDeletingSubjects}
                    className="w-full"
                  >
                    {isDeletingSubjects ? 'Siliniyor...' : 'Tümünü Sil'}
                  </Button>
                )}
              </div>
            </div>
            {/* Derslikler */}
            <div className="bg-teal-50 rounded-xl p-6 border border-teal-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
              <div className="flex flex-col items-center mb-4">
                <MapPin className="w-8 h-8 text-teal-600 mb-2" />
                <h3 className="text-base font-semibold text-teal-900 mb-1">Derslikler</h3>
                <span className="text-3xl font-extrabold text-teal-700 mb-1">{classrooms.length}</span>
                <p className="text-xs text-teal-700">Derslik kayıtları</p>
              </div>
              <div className="flex flex-col w-full gap-3 mt-auto pt-2">
                <Button
                  onClick={() => navigate('/classrooms')}
                  variant="secondary"
                  size="md"
                  className="w-full"
                >
                  Yönet
                </Button>
                {classrooms.length > 0 && (
                  <Button
                    onClick={handleDeleteAllClassrooms}
                    icon={Trash2}
                    variant="danger"
                    size="md"
                    disabled={isDeletingClassrooms}
                    className="w-full"
                  >
                    {isDeletingClassrooms ? 'Siliniyor...' : 'Tümünü Sil'}
                  </Button>
                )}
              </div>
            </div>
            {/* Programlar */}
            <div className="bg-purple-50 rounded-xl p-6 border border-purple-100 flex flex-col items-center justify-between min-h-[200px] shadow-sm">
              <div className="flex flex-col items-center mb-4">
                <Calendar className="w-8 h-8 text-purple-600 mb-2" />
                <h3 className="text-base font-semibold text-purple-900 mb-1">Programlar</h3>
                <span className="text-3xl font-extrabold text-purple-700 mb-1">{schedules.length}</span>
                <p className="text-xs text-purple-700">Program kayıtları</p>
              </div>
              <div className="flex flex-col w-full gap-2 mt-auto">
                <Button
                  onClick={() => navigate('/all-schedules')}
                  variant="secondary"
                  size="md"
                  className="w-full"
                >
                  Yönet
                </Button>
                {schedules.length > 0 && (
                  <Button
                    onClick={handleDeleteAllSchedules}
                    icon={Trash2}
                    variant="danger"
                    size="md"
                    disabled={isDeletingSchedules}
                    className="w-full"
                  >
                    {isDeletingSchedules ? 'Siliniyor...' : 'Tümünü Sil'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CSV Import Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <FileText className="w-6 h-6 text-green-600 mr-2" />
              <h2 className="text-lg font-bold text-gray-900">CSV İçe Aktarma</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
              <div className="flex items-center mb-4">
                <Users className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-medium text-blue-900">Öğretmen CSV İçe Aktarma</h3>
              </div>
              <p className="text-sm text-blue-700 mb-4">
                Excel'den dışa aktardığınız öğretmen verilerini CSV formatında içe aktarın. 
                Format: "Adı Soyadı", "Branşı", "Eğitim Seviyesi"
              </p>
              <div className="flex items-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleTeacherCSVUpload}
                  ref={teacherFileInputRef}
                  className="hidden"
                  id="teacher-csv-upload"
                />
                <label
                  htmlFor="teacher-csv-upload"
                  className="cursor-pointer bg-white hover:bg-blue-50 text-blue-600 font-medium py-2 px-4 border border-blue-300 rounded-lg inline-flex items-center transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  CSV Dosyası Seç
                </label>
              </div>
            </div>
            
            <div className="bg-indigo-50 rounded-lg p-5 border border-indigo-100">
              <div className="flex items-center mb-4">
                <BookOpen className="w-5 h-5 text-indigo-600 mr-2" />
                <h3 className="font-medium text-indigo-900">Ders CSV İçe Aktarma</h3>
              </div>
              <p className="text-sm text-indigo-700 mb-4">
                Excel'den dışa aktardığınız ders verilerini CSV formatında içe aktarın.
                Format: "Ders Adı", "Branş", "Eğitim Seviyesi", "Haftalık Saat"
              </p>
              <div className="flex items-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleSubjectCSVUpload}
                  ref={subjectFileInputRef}
                  className="hidden"
                  id="subject-csv-upload"
                />
                <label
                  htmlFor="subject-csv-upload"
                  className="cursor-pointer bg-white hover:bg-indigo-50 text-indigo-600 font-medium py-2 px-4 border border-indigo-300 rounded-lg inline-flex items-center transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  CSV Dosyası Seç
                </label>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-gray-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <h4 className="font-medium mb-2">CSV İçe Aktarma Rehberi</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Öğretmen CSV Formatı:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Sütun başlıkları: <code className="bg-gray-100 px-1 py-0.5 rounded">Adı Soyadı</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Branşı</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Eğitim Seviyesi</code></li>
                      <li>Eğitim seviyesi: Anaokulu, İlkokul, Ortaokul</li>
                      <li>Excel'den "CSV UTF-8" formatında kaydedin</li>
                      <li>Türkçe karakter desteği mevcuttur</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Ders CSV Formatı:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Sütun başlıkları: <code className="bg-gray-100 px-1 py-0.5 rounded">Ders</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Branş</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Eğitim Seviyesi</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">Ders Saati</code></li>
                      <li>Eğitim seviyesi: Anaokulu, İlkokul, Ortaokul</li>
                      <li>Ders saati: 1-30 arası sayı</li>
                      <li>Excel'den "CSV UTF-8" formatında kaydedin</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Data Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Database className="w-6 h-6 text-purple-600 mr-2" />
              <h2 className="text-lg font-bold text-gray-900">Toplu Veri Yönetimi</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center mb-4">
                <Download className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-medium text-blue-900">Veri Yedekleme</h3>
              </div>
              <p className="text-sm text-blue-700 mb-4">
                Tüm sistem verilerinizi yedekleyin ve dışa aktarın. Bu işlem tüm öğretmen, sınıf, ders ve program verilerinizi içerir.
              </p>
              <Button
                variant="primary"
                icon={Download}
                className="w-full"
                disabled
              >
                Tüm Verileri Yedekle (Yakında)
              </Button>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <div className="flex items-center mb-4">
                <Upload className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="font-medium text-green-900">Veri Geri Yükleme</h3>
              </div>
              <p className="text-sm text-green-700 mb-4">
                Önceden yedeklediğiniz verileri sisteme geri yükleyin. Bu işlem mevcut verilerinizin üzerine yazacaktır.
              </p>
              <Button
                variant="primary"
                icon={Upload}
                className="w-full"
                disabled
              >
                Verileri Geri Yükle (Yakında)
              </Button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-6">
          <div className="flex items-center mb-6">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
            <h2 className="text-lg font-bold text-red-900">Tehlikeli Bölge</h2>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-red-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-red-900">Tüm Verileri Sil</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Bu işlem tüm öğretmen, sınıf, ders, program ve şablon verilerinizi kalıcı olarak silecektir. Bu işlem geri alınamaz!
                  </p>
                </div>
                <Button
                  onClick={handleDeleteAllData}
                  icon={Trash2}
                  variant="danger"
                  disabled={isDeletingAll || totalDataCount === 0}
                >
                  {isDeletingAll ? 'Siliniyor...' : `Tüm Verileri Sil (${totalDataCount})`}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <Button
                onClick={handleDeleteAllTeachers}
                icon={Trash2}
                variant="danger"
                disabled={isDeletingTeachers || teachers.length === 0}
                className="w-full"
              >
                {isDeletingTeachers ? 'Siliniyor...' : `Öğretmenler (${teachers.length})`}
              </Button>
              
              <Button
                onClick={handleDeleteAllClasses}
                icon={Trash2}
                variant="danger"
                disabled={isDeletingClasses || classes.length === 0}
                className="w-full"
              >
                {isDeletingClasses ? 'Siliniyor...' : `Sınıflar (${classes.length})`}
              </Button>
              
              <Button
                onClick={handleDeleteAllSubjects}
                icon={Trash2}
                variant="danger"
                disabled={isDeletingSubjects || subjects.length === 0}
                className="w-full"
              >
                {isDeletingSubjects ? 'Siliniyor...' : `Dersler (${subjects.length})`}
              </Button>
              
              <Button
                onClick={handleDeleteAllSchedules}
                icon={Trash2}
                variant="danger"
                disabled={isDeletingSchedules || schedules.length === 0}
                className="w-full"
              >
                {isDeletingSchedules ? 'Siliniyor...' : `Programlar (${schedules.length})`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher CSV Import Modal */}
      <Modal
        isOpen={isTeacherCSVModalOpen}
        onClose={() => setIsTeacherCSVModalOpen(false)}
        title="Öğretmen CSV İçe Aktarma"
        size="xl"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-800 mb-1">CSV İçe Aktarma Bilgisi</h4>
                <p className="text-sm text-blue-700">
                  {csvTeachers.length} öğretmen verisi bulundu. 
                  {csvTeachers.filter(t => t.isValid && !t.exists).length} yeni öğretmen içe aktarılacak.
                  {csvTeachers.filter(t => t.exists).length > 0 && ` ${csvTeachers.filter(t => t.exists).length} öğretmen zaten mevcut.`}
                  {csvTeachers.filter(t => !t.isValid).length > 0 && ` ${csvTeachers.filter(t => !t.isValid).length} geçersiz veri.`}
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Adı Soyadı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branşı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Eğitim Seviyesi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Not
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvTeachers.map((teacher, index) => (
                    <tr key={index} className={
                      teacher.exists ? 'bg-yellow-50' : 
                      !teacher.isValid ? 'bg-red-50' : 
                      'hover:bg-gray-50'
                    }>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {teacher.exists ? (
                            <div className="text-yellow-500">
                              <AlertTriangle size={16} />
                            </div>
                          ) : teacher.isValid ? (
                            <div className="text-green-500">
                              <CheckCircle size={16} />
                            </div>
                          ) : (
                            <div className="text-red-500">
                              <XCircle size={16} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{teacher.branch}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          teacher.level === 'Anaokulu' ? 'bg-green-100 text-green-800' :
                          teacher.level === 'İlkokul' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {teacher.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {teacher.exists ? 'Zaten mevcut' : 
                           !teacher.isValid ? teacher.error : 
                           'İçe aktarılacak'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              onClick={() => setIsTeacherCSVModalOpen(false)}
              variant="secondary"
            >
              İptal
            </Button>
            <Button
              type="button"
              onClick={handleImportTeachers}
              variant="primary"
              disabled={isImportingTeachers || csvTeachers.filter(t => t.isValid && !t.exists).length === 0}
            >
              {isImportingTeachers ? 'İçe Aktarılıyor...' : `${csvTeachers.filter(t => t.isValid && !t.exists).length} Öğretmeni İçe Aktar`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Subject CSV Import Modal */}
      <Modal
        isOpen={isSubjectCSVModalOpen}
        onClose={() => setIsSubjectCSVModalOpen(false)}
        title="Ders CSV İçe Aktarma"
        size="xl"
      >
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-indigo-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-indigo-800 mb-1">CSV İçe Aktarma Bilgisi</h4>
                <p className="text-sm text-indigo-700">
                  {csvSubjects.length} ders verisi bulundu. 
                  {csvSubjects.filter(s => s.isValid && !s.exists).length} yeni ders içe aktarılacak.
                  {csvSubjects.filter(s => s.exists).length > 0 && ` ${csvSubjects.filter(s => s.exists).length} ders zaten mevcut.`}
                  {csvSubjects.filter(s => !s.isValid).length > 0 && ` ${csvSubjects.filter(s => !s.isValid).length} geçersiz veri.`}
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ders Adı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branş
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Eğitim Seviyesi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Haftalık Saat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Not
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvSubjects.map((subject, index) => (
                    <tr key={index} className={
                      subject.exists ? 'bg-yellow-50' : 
                      !subject.isValid ? 'bg-red-50' : 
                      'hover:bg-gray-50'
                    }>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {subject.exists ? (
                            <div className="text-yellow-500">
                              <AlertTriangle size={16} />
                            </div>
                          ) : subject.isValid ? (
                            <div className="text-green-500">
                              <CheckCircle size={16} />
                            </div>
                          ) : (
                            <div className="text-red-500">
                              <XCircle size={16} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{subject.branch}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          subject.level === 'Anaokulu' ? 'bg-green-100 text-green-800' :
                          subject.level === 'İlkokul' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {subject.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{subject.weeklyHours} saat</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {subject.exists ? 'Zaten mevcut' : 
                           !subject.isValid ? subject.error : 
                           'İçe aktarılacak'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              onClick={() => setIsSubjectCSVModalOpen(false)}
              variant="secondary"
            >
              İptal
            </Button>
            <Button
              type="button"
              onClick={handleImportSubjects}
              variant="primary"
              disabled={isImportingSubjects || csvSubjects.filter(s => s.isValid && !s.exists).length === 0}
            >
              {isImportingSubjects ? 'İçe Aktarılıyor...' : `${csvSubjects.filter(s => s.isValid && !s.exists).length} Dersi İçe Aktar`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={hideConfirmation}
        onConfirm={confirmation.onConfirm}
        title={confirmation.title}
        message={confirmation.message}
        type={confirmation.type}
        confirmText={confirmation.confirmText}
        cancelText={confirmation.cancelText}
        confirmVariant={confirmation.confirmVariant}
      />
    </div>
  );
};

export default DataManagement;