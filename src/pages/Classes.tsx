import React, { useState } from 'react';
import { Plus, Edit, Trash2, Building, Eye, Calendar, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Class, EDUCATION_LEVELS, Schedule, Teacher } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { useToast } from '../hooks/useToast';
import { useConfirmation } from '../hooks/useConfirmation';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import ConfirmationModal from '../components/UI/ConfirmationModal';

const Classes = () => {
  const navigate = useNavigate();
  const { data: classes, loading, add, update, remove } = useFirestore<Class>('classes');
  const { data: schedules } = useFirestore<Schedule>('schedules');
  const { data: teachers } = useFirestore<Teacher>('teachers');
  const { success, error, warning } = useToast();
  const { 
    confirmation, 
    showConfirmation, 
    hideConfirmation,
    confirmDelete 
  } = useConfirmation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [levelFilter, setLevelFilter] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [bulkClasses, setBulkClasses] = useState([
    { name: '', level: '' }
  ]);
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    teacherIds: [] as string[],
    classTeacherId: ''
  });

  // Check if a class has a schedule
  const hasSchedule = (classId: string) => {
    return schedules.some(schedule => {
      return Object.values(schedule.schedule).some(day => 
        Object.values(day).some(slot => slot?.classId === classId)
      );
    });
  };

  // Get weekly hours for a class
  const getWeeklyHours = (classId: string) => {
    let totalHours = 0;
    schedules.forEach(schedule => {
      Object.values(schedule.schedule).forEach(day => {
        Object.values(day).forEach(slot => {
          if (slot?.classId === classId) {
            totalHours++;
          }
        });
      });
    });
    return totalHours;
  };

  // Navigate to class schedules page with selected class
  const handleViewSchedule = (classId: string) => {
    navigate(`/class-schedules?classId=${classId}`);
  };

  // Navigate to schedule creator with class pre-selected
  const handleCreateSchedule = (classId: string) => {
    navigate(`/schedules?mode=class&classId=${classId}`);
  };

  // Filter classes
  const getFilteredClasses = () => {
    return classes.filter(classItem => {
      const matchesLevel = !levelFilter || classItem.level === levelFilter;
      return matchesLevel;
    });
  };

  const sortedClasses = getFilteredClasses().sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  // NEW: Delete all classes function
  const handleDeleteAllClasses = () => {
    if (classes.length === 0) {
      warning('⚠️ Silinecek Sınıf Yok', 'Sistemde silinecek sınıf bulunamadı');
      return;
    }

    confirmDelete(
      `${classes.length} Sınıf`,
      async () => {
        setIsDeletingAll(true);
        
        try {
          let deletedCount = 0;
          
          console.log('🗑️ Tüm sınıflar siliniyor:', {
            totalClasses: classes.length
          });

          // Delete each class
          for (const classItem of classes) {
            try {
              await remove(classItem.id);
              deletedCount++;
              console.log(`✅ Sınıf silindi: ${classItem.name}`);
            } catch (err) {
              console.error(`❌ Sınıf silinemedi: ${classItem.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Sınıflar Silindi', `${deletedCount} sınıf başarıyla silindi`);
            
            // Reset filters
            setLevelFilter('');
          } else {
            error('❌ Silme Hatası', 'Hiçbir sınıf silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Sınıflar silinirken bir hata oluştu');
        } finally {
          setIsDeletingAll(false);
        }
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const classData = {
      name: formData.name,
      level: formData.level,
      teacherIds: formData.teacherIds,
      classTeacherId: formData.classTeacherId
    };
    
    if (editingClass) {
      await update(editingClass.id, classData);
      success('✅ Sınıf Güncellendi', `${formData.name} sınıfı başarıyla güncellendi`);
    } else {
      await add(classData as Omit<Class, 'id' | 'createdAt'>);
      success('✅ Sınıf Eklendi', `${formData.name} sınıfı başarıyla eklendi`);
    }
    
    resetForm();
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    for (const classItem of bulkClasses) {
      if (classItem.name && classItem.level) {
        if (EDUCATION_LEVELS.includes(classItem.level as any)) {
          await add({
            name: classItem.name,
            level: classItem.level as Class['level'],
            teacherIds: []
          } as Omit<Class, 'id' | 'createdAt'>);
        }
      }
    }
    
    setBulkClasses([{ name: '', level: '' }]);
    setIsBulkModalOpen(false);
    success('✅ Sınıflar Eklendi', `${bulkClasses.filter(c => c.name && c.level).length} sınıf başarıyla eklendi`);
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      level: '', 
      teacherIds: [],
      classTeacherId: ''
    });
    setEditingClass(null);
    setIsModalOpen(false);
  };

  const handleEdit = (classItem: Class) => {
    setFormData({
      name: classItem.name,
      level: classItem.level,
      teacherIds: classItem.teacherIds || [],
      classTeacherId: classItem.classTeacherId || ''
    });
    setEditingClass(classItem);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const classItem = classes.find(c => c.id === id);
    if (classItem) {
      confirmDelete(
        classItem.name,
        async () => {
          await remove(id);
          success('🗑️ Sınıf Silindi', `${classItem.name} başarıyla silindi`);
        }
      );
    }
  };

  const addBulkRow = () => {
    setBulkClasses([...bulkClasses, { name: '', level: '' }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkClasses.length > 1) {
      setBulkClasses(bulkClasses.filter((_, i) => i !== index));
    }
  };

  const updateBulkRow = (index: number, field: string, value: string) => {
    const updated = [...bulkClasses];
    updated[index] = { ...updated[index], [field]: value };
    setBulkClasses(updated);
  };

  // Öğretmen seçimi için yardımcı fonksiyonlar
  const handleTeacherToggle = (teacherId: string) => {
    setFormData(prev => {
      const isSelected = prev.teacherIds.includes(teacherId);
      
      if (isSelected) {
        // Öğretmeni kaldır
        const newTeacherIds = prev.teacherIds.filter(id => id !== teacherId);
        
        // Eğer sınıf öğretmeni de kaldırılıyorsa, sınıf öğretmeni ID'sini de temizle
        const newClassTeacherId = prev.classTeacherId === teacherId ? '' : prev.classTeacherId;
        
        return {
          ...prev,
          teacherIds: newTeacherIds,
          classTeacherId: newClassTeacherId
        };
      } else {
        // Öğretmeni ekle
        return {
          ...prev,
          teacherIds: [...prev.teacherIds, teacherId]
        };
      }
    });
  };

  const handleSetClassTeacher = (teacherId: string) => {
    setFormData(prev => {
      // Eğer öğretmen seçili değilse, önce öğretmenler listesine ekle
      const newTeacherIds = prev.teacherIds.includes(teacherId) 
        ? prev.teacherIds 
        : [...prev.teacherIds, teacherId];
      
      return {
        ...prev,
        teacherIds: newTeacherIds,
        classTeacherId: teacherId
      };
    });
  };

  // Filtrelenmiş öğretmen listesi - sınıf seviyesine göre
  const getFilteredTeachers = () => {
    if (!formData.level) return [];
    
    return teachers
      .filter(teacher => teacher.level === formData.level)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  };

  // Sınıf öğretmeni adını getir
  const getClassTeacherName = (classTeacherId: string | undefined) => {
    if (!classTeacherId) return '';
    const teacher = teachers.find(t => t.id === classTeacherId);
    return teacher ? teacher.name : '';
  };

  // Sınıf öğretmenlerinin adlarını getir
  const getClassTeacherNames = (teacherIds: string[] | undefined) => {
    if (!teacherIds || teacherIds.length === 0) return '';
    
    const classTeachers = teachers.filter(t => teacherIds.includes(t.id));
    return classTeachers.map(t => t.name).join(', ');
  };

  const levelOptions = EDUCATION_LEVELS.map(level => ({
    value: level,
    label: level
  }));

  const levelFilterOptions = [
    { value: '', label: 'Tüm Seviyeler' },
    ...levelOptions
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="mobile-loading">
          <div className="mobile-loading-spinner"></div>
          <div className="mobile-loading-text">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-mobile">
      {/* FIXED: Mobile-optimized header with consistent spacing */}
      <div className="header-mobile">
        <div className="flex items-center">
          <Building className="w-8 h-8 text-emerald-600 mr-3" />
          <div>
            <h1 className="text-responsive-xl font-bold text-gray-900">Sınıflar</h1>
            <p className="text-responsive-sm text-gray-600">{classes.length} sınıf kayıtlı ({sortedClasses.length} gösteriliyor)</p>
          </div>
        </div>
        <div className="button-group-mobile">
          {/* NEW: Delete All Button */}
          {classes.length > 0 && (
            <Button
              onClick={handleDeleteAllClasses}
              icon={Trash2}
              variant="danger"
              disabled={isDeletingAll}
              className="w-full sm:w-auto"
            >
              {isDeletingAll ? 'Siliniyor...' : `Tümünü Sil (${classes.length})`}
            </Button>
          )}
          
          <Button
            onClick={() => setIsBulkModalOpen(true)}
            icon={Plus}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            Toplu Ekle
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            icon={Plus}
            variant="primary"
            className="w-full sm:w-auto"
          >
            Yeni Sınıf
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mobile-card mobile-spacing mb-6">
        <div className="responsive-grid-1 gap-responsive">
          <Select
            label="Seviye Filtresi"
            value={levelFilter}
            onChange={setLevelFilter}
            options={levelFilterOptions}
          />
        </div>
      </div>

      {sortedClasses.length === 0 ? (
        <div className="text-center py-12 mobile-card">
          <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {classes.length === 0 ? 'Henüz sınıf eklenmemiş' : 'Filtrelere uygun sınıf bulunamadı'}
          </h3>
          <p className="text-gray-500 mb-4">
            {classes.length === 0 ? 'İlk sınıfınızı ekleyerek başlayın' : 'Farklı filtre kriterleri deneyin'}
          </p>
          <div className="button-group-mobile">
            {classes.length === 0 && (
              <>
                <Button
                  onClick={() => setIsBulkModalOpen(true)}
                  icon={Plus}
                  variant="secondary"
                >
                  Toplu Ekle
                </Button>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  icon={Plus}
                  variant="primary"
                >
                  Sınıf Ekle
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="responsive-grid gap-responsive">
          {sortedClasses.map((classItem) => {
            const classHasSchedule = hasSchedule(classItem.id);
            const weeklyHours = getWeeklyHours(classItem.id);
            const classTeacherName = getClassTeacherName(classItem.classTeacherId);
            const classTeacherNames = getClassTeacherNames(classItem.teacherIds);
            
            return (
              <div key={classItem.id} className="mobile-card mobile-spacing hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{classItem.name}</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    classItem.level === 'Anaokulu' ? 'bg-green-100 text-green-800' :
                    classItem.level === 'İlkokul' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {classItem.level}
                  </span>
                </div>
                
                {/* Öğretmen Bilgisi */}
                {(classTeacherName || classTeacherNames) && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 text-blue-600 mr-2" />
                      <div>
                        {classTeacherName && (
                          <p className="text-sm font-medium text-blue-700">
                            <span className="font-bold">Sınıf Öğretmeni:</span> {classTeacherName}
                          </p>
                        )}
                        {classTeacherNames && (
                          <p className="text-sm text-blue-600 mt-1">
                            <span className="font-medium">Öğretmenler:</span> {classTeacherNames}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Schedule Status */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Program Durumu</p>
                      <div className="flex items-center mt-1">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          classHasSchedule ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <span className={`text-sm ${
                          classHasSchedule ? 'text-green-700' : 'text-gray-500'
                        }`}>
                          {classHasSchedule ? `${weeklyHours} ders saati` : 'Program yok'}
                        </span>
                      </div>
                    </div>
                    {classHasSchedule && (
                      <button
                        onClick={() => handleViewSchedule(classItem.id)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        title="Programı Görüntüle"
                        aria-label={`${classItem.name} sınıfının programını görüntüle`}
                      >
                        <Eye size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEdit(classItem)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      title="Sınıfı Düzenle"
                      aria-label={`${classItem.name} sınıfını düzenle`}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(classItem.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      title="Sınıfı Sil"
                      aria-label={`${classItem.name} sınıfını sil`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => handleCreateSchedule(classItem.id)}
                    className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    title={classHasSchedule ? "Programı Düzenle" : "Program Oluştur"}
                    aria-label={`${classItem.name} sınıfı için ${classHasSchedule ? 'programı düzenle' : 'program oluştur'}`}
                  >
                    <Calendar size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single Class Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingClass ? 'Sınıf Düzenle' : 'Yeni Sınıf Ekle'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Temel Bilgiler */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sınıf Bilgileri</h3>
              <div className="space-y-4">
                <Input
                  label="Sınıf Adı"
                  value={formData.name}
                  onChange={(value) => setFormData({ ...formData, name: value })}
                  placeholder="Örn: 5A, 7B"
                  required
                />
                
                <Select
                  label="Eğitim Seviyesi"
                  value={formData.level}
                  onChange={(value) => setFormData({ ...formData, level: value })}
                  options={levelOptions}
                  required
                />
              </div>
            </div>
            
            {/* Öğretmen Seçimi - Sadece seviye seçildiğinde göster */}
            {formData.level && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-blue-600" />
                  Sınıf Öğretmenleri
                </h3>
                
                {getFilteredTeachers().length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {formData.level} seviyesinde öğretmen bulunamadı
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Önce öğretmen ekleyin veya farklı bir seviye seçin
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Sınıf Öğretmeni Seçimi */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sınıf Öğretmeni
                      </label>
                      <select
                        value={formData.classTeacherId}
                        onChange={(e) => handleSetClassTeacher(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sınıf öğretmeni seçin...</option>
                        {getFilteredTeachers().map(teacher => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name} ({teacher.branch})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Öğretmen Listesi */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sınıfta Ders Verecek Öğretmenler
                      </label>
                      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                        <div className="divide-y divide-gray-200">
                          {getFilteredTeachers().map(teacher => {
                            const isSelected = formData.teacherIds.includes(teacher.id);
                            const isClassTeacher = formData.classTeacherId === teacher.id;
                            
                            return (
                              <div 
                                key={teacher.id}
                                className={`p-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                                  isClassTeacher ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    id={`teacher-${teacher.id}`}
                                    checked={isSelected}
                                    onChange={() => handleTeacherToggle(teacher.id)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <label 
                                    htmlFor={`teacher-${teacher.id}`}
                                    className="ml-3 block text-sm font-medium text-gray-700 cursor-pointer"
                                  >
                                    {teacher.name}
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({teacher.branch})
                                    </span>
                                    {isClassTeacher && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        Sınıf Öğretmeni
                                      </span>
                                    )}
                                  </label>
                                </div>
                                
                                {!isClassTeacher && isSelected && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetClassTeacher(teacher.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    Sınıf öğretmeni yap
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-500 flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        <span>
                          {formData.teacherIds.length} öğretmen seçildi
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="button-group-mobile mt-6">
            <Button
              type="button"
              onClick={resetForm}
              variant="secondary"
            >
              İptal
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              {editingClass ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Toplu Sınıf Ekleme"
      >
        <form onSubmit={handleBulkSubmit}>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Sınıf Listesi
                <span className="text-red-500">*</span>
              </label>
              <Button
                type="button"
                onClick={addBulkRow}
                variant="secondary"
                size="sm"
              >
                + Satır Ekle
              </Button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {bulkClasses.map((classItem, index) => (
                <div key={index} className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    placeholder="Sınıf Adı"
                    value={classItem.name}
                    onChange={(e) => updateBulkRow(index, 'name', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <select
                    value={classItem.level}
                    onChange={(e) => updateBulkRow(index, 'level', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seviye</option>
                    {EDUCATION_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeBulkRow(index)}
                    className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                    disabled={bulkClasses.length === 1}
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Örnek Sınıflar:</h4>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• 5A - İlkokul</p>
              <p>• 7B - Ortaokul</p>
              <p>• Papatya - Anaokulu</p>
            </div>
          </div>

          <div className="button-group-mobile">
            <Button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              variant="secondary"
            >
              İptal
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Toplu Ekle ({bulkClasses.filter(c => c.name && c.level).length} sınıf)
            </Button>
          </div>
        </form>
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

export default Classes;