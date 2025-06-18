import React, { useState, useEffect } from 'react';
import { Building, Users, Plus, Minus, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { Class, EDUCATION_LEVELS, Teacher } from '../../types';
import { WizardData } from '../../types/wizard';
import { useFirestore } from '../../hooks/useFirestore';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Modal from '../UI/Modal';
import Input from '../UI/Input';

interface WizardStepClassesProps {
  data: {
    classes?: {
      selectedClasses: string[];
      classCapacities: { [classId: string]: number };
      classPreferences: { [classId: string]: string[] };
    }
  };
  onUpdate: (data: { classes: any }) => void;
  classes: Class[];
}

const WizardStepClasses: React.FC<WizardStepClassesProps> = ({
  data,
  onUpdate,
  classes
}) => {
  const { add: addClass, update: updateClass, remove: removeClass } = useFirestore<Class>('classes');
  const { data: classrooms } = useFirestore('classrooms');
  const { data: teachers } = useFirestore<Teacher>('teachers');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    classTeacherId: '',
    teacherIds: [] as string[],
    color: '',
    mainClassroom: '',
    level: ''
  });
  
  // Initialize classes data if it doesn't exist
  const classesData = data.classes || {
    selectedClasses: [],
    classCapacities: {},
    classPreferences: {}
  };

  // Auto-generate short name from class name
  const generateShortName = (name: string): string => {
    if (!name) return '';
    
    // Take first 2 characters and make uppercase
    return name.substring(0, 2).toUpperCase();
  };

  // Auto-generate color based on level
  const generateColor = (level: string): string => {
    const colors = {
      'Anaokulu': '#10B981', // Green
      'İlkokul': '#3B82F6',   // Blue  
      'Ortaokul': '#8B5CF6'   // Purple
    };
    return colors[level as keyof typeof colors] || '#6B7280';
  };

  const handleClassToggle = (classId: string) => {
    const isSelected = classesData.selectedClasses.includes(classId);
    const classItem = classes.find(c => c.id === classId);
    
    if (isSelected) {
      // Remove class
      const newSelectedClasses = classesData.selectedClasses.filter(id => id !== classId);
      const newClassCapacities = { ...classesData.classCapacities };
      const newClassPreferences = { ...classesData.classPreferences };
      
      delete newClassCapacities[classId];
      delete newClassPreferences[classId];
      
      onUpdate({
        classes: {
          ...classesData,
          selectedClasses: newSelectedClasses,
          classCapacities: newClassCapacities,
          classPreferences: newClassPreferences
        }
      });
    } else {
      // Add class
      const newSelectedClasses = [...classesData.selectedClasses, classId];
      
      onUpdate({
        classes: {
          ...classesData,
          selectedClasses: newSelectedClasses,
          classCapacities: {
            ...classesData.classCapacities,
            [classId]: 30 // Default capacity
          }
        }
      });
    }
  };

  const handleCapacityChange = (classId: string, capacity: number) => {
    onUpdate({
      classes: {
        ...classesData,
        classCapacities: {
          ...classesData.classCapacities,
          [classId]: Math.max(1, capacity)
        }
      }
    });
  };

  const handleSelectAll = () => {
    const filteredClasses = selectedLevel 
      ? classes.filter(c => c.level === selectedLevel)
      : classes;
    
    const newClassCapacities = { ...classesData.classCapacities };
    
    filteredClasses.forEach(c => {
      if (!newClassCapacities[c.id]) {
        newClassCapacities[c.id] = 30; // Default capacity
      }
    });
    
    onUpdate({
      classes: {
        ...classesData,
        selectedClasses: filteredClasses.map(c => c.id),
        classCapacities: newClassCapacities
      }
    });
  };

  const handleDeselectAll = () => {
    const filteredClasses = selectedLevel 
      ? classes.filter(c => c.level === selectedLevel)
      : classes;
    
    const newSelectedClasses = classesData.selectedClasses.filter(
      id => !filteredClasses.some(c => c.id === id)
    );
    
    const newClassCapacities = { ...classesData.classCapacities };
    const newClassPreferences = { ...classesData.classPreferences };
    
    filteredClasses.forEach(c => {
      delete newClassCapacities[c.id];
      delete newClassPreferences[c.id];
    });
    
    onUpdate({
      classes: {
        ...classesData,
        selectedClasses: newSelectedClasses,
        classCapacities: newClassCapacities,
        classPreferences: newClassPreferences
      }
    });
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

  // New Class Modal Functions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const classData = {
        name: formData.name,
        level: formData.level,
        teacherIds: formData.teacherIds,
        classTeacherId: formData.classTeacherId,
        // Store additional metadata in a way that's compatible with existing Class type
        shortName: formData.shortName || generateShortName(formData.name),
        color: formData.color || generateColor(formData.level)
      };

      if (editingClass) {
        await updateClass(editingClass.id, classData);
      } else {
        await addClass(classData as Omit<Class, 'id' | 'createdAt'>);
      }
      resetForm();
    } catch (error) {
      console.error("Error saving class:", error);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      shortName: '',
      classTeacherId: '',
      teacherIds: [],
      color: '',
      mainClassroom: '',
      level: '' 
    });
    setEditingClass(null);
    setIsModalOpen(false);
  };

  const handleEdit = (classItem: Class) => {
    setFormData({
      name: classItem.name,
      shortName: (classItem as any).shortName || generateShortName(classItem.name),
      classTeacherId: classItem.classTeacherId || '',
      teacherIds: classItem.teacherIds || [],
      color: (classItem as any).color || generateColor(classItem.level),
      mainClassroom: '',
      level: classItem.level
    });
    setEditingClass(classItem);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await removeClass(id);
      // If the deleted class was selected, remove it from selection
      if (classesData.selectedClasses.includes(id)) {
        handleClassToggle(id);
      }
    } catch (error) {
      console.error("Error deleting class:", error);
    }
  };

  // Auto-update short name when name changes
  React.useEffect(() => {
    if (formData.name && !editingClass) {
      setFormData(prev => ({
        ...prev,
        shortName: generateShortName(prev.name)
      }));
    }
  }, [formData.name, editingClass]);

  // Auto-update color when level changes
  React.useEffect(() => {
    if (formData.level && !editingClass) {
      setFormData(prev => ({
        ...prev,
        color: generateColor(prev.level)
      }));
    }
  }, [formData.level, editingClass]);

  const levelOptions = [
    { value: '', label: 'Tüm Seviyeler' },
    { value: 'Anaokulu', label: 'Anaokulu' },
    { value: 'İlkokul', label: 'İlkokul' },
    { value: 'Ortaokul', label: 'Ortaokul' }
  ];

  // Get classroom options for select
  const classroomOptions = [
    { value: '', label: 'Seçiniz...' },
    ...classrooms.map(classroom => ({
      value: classroom.id,
      label: classroom.name
    }))
  ];

  // Get teacher options for select
  const teacherOptions = [
    { value: '', label: 'Seçiniz...' },
    ...teachers.map(teacher => ({
      value: teacher.id,
      label: `${teacher.name} (${teacher.branch})`
    }))
  ];

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

  const filteredClasses = selectedLevel 
    ? classes.filter(c => c.level === selectedLevel)
    : classes;

  const groupedClasses = filteredClasses.reduce((acc, classItem) => {
    if (!acc[classItem.level]) {
      acc[classItem.level] = [];
    }
    acc[classItem.level].push(classItem);
    return acc;
  }, {} as Record<string, Class[]>);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Building className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sınıf Seçimi</h2>
        <p className="text-gray-600">
          Programa dahil edilecek sınıfları seçin ve kapasitelerini belirleyin
        </p>
      </div>

      {/* Filter and Add Button */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="md:w-1/2">
          <Select
            label="Seviye Filtresi"
            value={selectedLevel}
            onChange={setSelectedLevel}
            options={levelOptions}
          />
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          icon={Plus}
          variant="primary"
        >
          Yeni Sınıf Ekle
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-blue-900">Seçilen Sınıflar</h3>
            <p className="text-sm text-blue-700">
              {classesData.selectedClasses.length} / {classes.length} sınıf seçildi
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={handleSelectAll}
              variant="secondary"
              size="sm"
            >
              {selectedLevel ? `${selectedLevel} Tümünü Seç` : 'Tümünü Seç'}
            </Button>
            <Button
              onClick={handleDeselectAll}
              variant="secondary"
              size="sm"
            >
              {selectedLevel ? `${selectedLevel} Tümünü Kaldır` : 'Tümünü Kaldır'}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedClasses).map(([level, levelClasses]) => (
          <div key={level} className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-emerald-600" />
              {level}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({levelClasses.filter(c => classesData.selectedClasses.includes(c.id)).length}/{levelClasses.length})
              </span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {levelClasses.map((classItem) => {
                const isSelected = classesData.selectedClasses.includes(classItem.id);
                const capacity = classesData.classCapacities[classItem.id] || 30;
                const classTeacherName = getClassTeacherName(classItem.classTeacherId);
                const classTeacherNames = getClassTeacherNames(classItem.teacherIds);
                
                return (
                  <div
                    key={classItem.id}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 bg-gray-50 hover:border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div
                          onClick={() => handleClassToggle(classItem.id)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{classItem.name}</h4>
                          <p className="text-xs text-gray-600">{classItem.level}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEdit(classItem)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Sınıfı düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(classItem.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Sınıfı sil"
                        >
                          <Trash2 size={16} />
                        </button>
                        {isSelected && (
                          <button
                            onClick={() => handleClassToggle(classItem.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Sınıfı kaldır"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Öğretmen Bilgisi */}
                    {classItem.teacherIds && classItem.teacherIds.length > 0 && (
                      <div className="mt-2 mb-2 p-2 bg-blue-50 rounded border border-blue-100">
                        <div className="flex items-center">
                          <Users className="w-3 h-3 text-blue-600 mr-1" />
                          <p className="text-xs text-blue-700">
                            {classItem.teacherIds.length} öğretmen atanmış
                            {classItem.classTeacherId && (
                              <span className="ml-1 font-medium">
                                (Sınıf öğretmeni: {teachers.find(t => t.id === classItem.classTeacherId)?.name})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Sınıf Kapasitesi
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCapacityChange(classItem.id, capacity - 1);
                            }}
                            className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{capacity}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCapacityChange(classItem.id, capacity + 1);
                            }}
                            className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300"
                          >
                            +
                          </button>
                          <span className="text-xs text-gray-500">öğrenci</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {classes.length === 0 && (
        <div className="text-center py-8">
          <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sınıf Ekleyin</h3>
          <p className="text-gray-500">
            Henüz sınıf eklenmemiş. Yeni sınıf ekleyerek başlayın.
          </p>
          <Button
            onClick={() => setIsModalOpen(true)}
            icon={Plus}
            variant="primary"
            className="mt-4"
          >
            Yeni Sınıf Ekle
          </Button>
        </div>
      )}

      {classesData.selectedClasses.length === 0 && classes.length > 0 && (
        <div className="text-center py-8">
          <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sınıf Seçin</h3>
          <p className="text-gray-500">
            Programa dahil edilecek en az bir sınıf seçmelisiniz
          </p>
        </div>
      )}

      {classesData.selectedClasses.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h4 className="font-medium text-yellow-800">Sınıf Kapasitesi Önerileri</h4>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                <li>• Anaokulu: 15-20 öğrenci</li>
                <li>• İlkokul: 20-30 öğrenci</li>
                <li>• Ortaokul: 25-35 öğrenci</li>
                <li>• Kapasite bilgisi derslik atamalarında kullanılacaktır</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Class Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingClass ? 'Sınıf Düzenle' : 'Yeni Sınıf Ekle'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          {/* Temel Bilgiler */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sınıf Bilgileri</h3>
            <div className="space-y-4">
              {/* Required Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="İsim"
                  value={formData.name}
                  onChange={(value) => setFormData({ ...formData, name: value })}
                  placeholder="Örn: 5A, 7B"
                  required
                />
                
                <Input
                  label="Kısaltma"
                  value={formData.shortName}
                  onChange={(value) => setFormData({ ...formData, shortName: value })}
                  placeholder="Otomatik oluşturulur"
                  disabled
                />
              </div>

              <Select
                label="Seviye"
                value={formData.level}
                onChange={(value) => setFormData({ ...formData, level: value })}
                options={levelOptions.filter(option => option.value !== '')}
                required
              />

              <Input
                label="Renk"
                value={formData.color}
                onChange={(value) => setFormData({ ...formData, color: value })}
                placeholder="Otomatik atanır"
                disabled
              />
              
              <Select
                label="Ana derslik"
                value={formData.mainClassroom}
                onChange={(value) => setFormData({ ...formData, mainClassroom: value })}
                options={classroomOptions}
              />
            </div>
          </div>
          
          {/* Öğretmen Seçimi - Sadece seviye seçildiğinde göster */}
          {formData.level && (
            <div className="mt-6 pt-6 border-t border-gray-200">
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
              {editingClass ? 'Güncelle' : 'Tamamla'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WizardStepClasses;