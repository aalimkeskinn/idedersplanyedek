import React, { useState } from 'react';
import { Plus, Edit, Trash2, Users, Check } from 'lucide-react';
import { Teacher, EDUCATION_LEVELS } from '../../types';
import { useFirestore } from '../../hooks/useFirestore';
import { useToast } from '../../hooks/useToast';
import Button from '../UI/Button';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Select from '../UI/Select';

interface WizardStepTeachersProps {
  selectedTeachers: string[];
  onSelectedTeachersChange: (teacherIds: string[]) => void;
}

const WizardStepTeachers: React.FC<WizardStepTeachersProps> = ({
  selectedTeachers,
  onSelectedTeachersChange
}) => {
  const { data: teachers, add: addTeacher, update: updateTeacher, remove: removeTeacher } = useFirestore<Teacher>('teachers');
  const { success, error } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    shortName: '',
    rank: '',
    gender: '',
    title: '',
    lastAddition: '',
    classrooms: '',
    phoneNumber: '',
    branch: '',
    level: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Combine name and surname for the teacher name
      const fullName = `${formData.name} ${formData.surname}`.trim();
      
      const teacherData = {
        name: fullName,
        branch: formData.branch || 'Genel', // Default branch if not provided
        level: formData.level || 'İlkokul' // Default level if not provided
      };

      if (editingTeacher) {
        await updateTeacher(editingTeacher.id, teacherData);
        success('✅ Güncellendi', `${fullName} başarıyla güncellendi`);
      } else {
        await addTeacher(teacherData as Omit<Teacher, 'id' | 'createdAt'>);
        success('✅ Eklendi', `${fullName} başarıyla eklendi`);
      }
      resetForm();
    } catch (err) {
      error('❌ Hata', 'Öğretmen kaydedilirken bir hata oluştu');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      surname: '',
      shortName: '',
      rank: '',
      gender: '',
      title: '',
      lastAddition: '',
      classrooms: '',
      phoneNumber: '',
      branch: '',
      level: ''
    });
    setEditingTeacher(null);
    setIsModalOpen(false);
  };

  const handleEdit = (teacher: Teacher) => {
    // Split the full name back to name and surname for editing
    const nameParts = teacher.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    setFormData({
      name: firstName,
      surname: lastName,
      shortName: '',
      rank: '',
      gender: '',
      title: '',
      lastAddition: '',
      classrooms: '',
      phoneNumber: '',
      branch: teacher.branch,
      level: teacher.level
    });
    setEditingTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const teacher = teachers.find(t => t.id === id);
    if (teacher && window.confirm(`${teacher.name} öğretmenini silmek istediğinizden emin misiniz?`)) {
      try {
        await removeTeacher(id);
        success('🗑️ Silindi', `${teacher.name} başarıyla silindi`);
        
        // Remove from selected if it was selected
        const updatedSelected = selectedTeachers.filter(teacherId => teacherId !== id);
        onSelectedTeachersChange(updatedSelected);
      } catch (err) {
        error('❌ Hata', 'Öğretmen silinirken bir hata oluştu');
      }
    }
  };

  const handleTeacherToggle = (teacherId: string) => {
    if (selectedTeachers.includes(teacherId)) {
      onSelectedTeachersChange(selectedTeachers.filter(id => id !== teacherId));
    } else {
      onSelectedTeachersChange([...selectedTeachers, teacherId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedTeachers.length === teachers.length) {
      onSelectedTeachersChange([]);
    } else {
      onSelectedTeachersChange(teachers.map(teacher => teacher.id));
    }
  };

  const levelOptions = EDUCATION_LEVELS.map(level => ({
    value: level,
    label: level
  }));

  const rankOptions = [
    { value: '', label: 'Seçiniz...' },
    { value: 'Öğretmen', label: 'Öğretmen' },
    { value: 'Başöğretmen', label: 'Başöğretmen' },
    { value: 'Uzman Öğretmen', label: 'Uzman Öğretmen' },
    { value: 'Müdür Yardımcısı', label: 'Müdür Yardımcısı' },
    { value: 'Müdür', label: 'Müdür' }
  ];

  const genderOptions = [
    { value: '', label: 'Seçiniz...' },
    { value: 'Erkek', label: 'Erkek' },
    { value: 'Kadın', label: 'Kadın' }
  ];

  const sortedTeachers = [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Öğretmen Seçimi</h3>
        <p className="text-gray-600">
          Programa dahil edilecek öğretmenleri seçin
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Users className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Öğretmenler</h3>
            <p className="text-sm text-gray-600">
              {teachers.length} öğretmen • {selectedTeachers.length} seçili
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {teachers.length > 0 && (
            <Button
              onClick={handleSelectAll}
              variant="secondary"
              size="sm"
            >
              {selectedTeachers.length === teachers.length ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
            </Button>
          )}
          <Button
            onClick={() => setIsModalOpen(true)}
            icon={Plus}
            variant="primary"
            size="sm"
          >
            Öğretmen Ekle
          </Button>
        </div>
      </div>

      {/* Teachers List */}
      {sortedTeachers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz öğretmen eklenmemiş</h3>
          <p className="text-gray-500 mb-4">İlk öğretmeninizi ekleyerek başlayın</p>
          <Button
            onClick={() => setIsModalOpen(true)}
            icon={Plus}
            variant="primary"
          >
            Öğretmen Ekle
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTeachers.map((teacher) => {
            const isSelected = selectedTeachers.includes(teacher.id);
            
            return (
              <div
                key={teacher.id}
                className={`relative bg-white rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => handleTeacherToggle(teacher.id)}
              >
                {/* Selection Indicator */}
                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300 bg-white'
                }`}>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>

                {/* Teacher Info */}
                <div className="pr-8">
                  <h4 className="font-semibold text-gray-900 mb-2">{teacher.name}</h4>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Branş:</span> {teacher.branch}
                    </p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      teacher.level === 'Anaokulu' ? 'bg-green-100 text-green-800' :
                      teacher.level === 'İlkokul' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {teacher.level}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="absolute bottom-3 right-3 flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(teacher);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Düzenle"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(teacher.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selection Summary */}
      {teachers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-blue-800">Seçim Özeti</h4>
              <p className="text-sm text-blue-600 mt-1">
                {selectedTeachers.length} öğretmen seçildi
              </p>
            </div>
            {selectedTeachers.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-blue-600">
                  Seçilen öğretmenler program oluşturma sürecinde kullanılacak
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Teacher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingTeacher ? 'Öğretmen Düzenle' : 'Yeni Öğretmen Ekle'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Required Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="İsim"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="Örn: Ahmet"
              required
            />
            
            <Input
              label="Soy isim"
              value={formData.surname}
              onChange={(value) => setFormData({ ...formData, surname: value })}
              placeholder="Örn: Yılmaz"
              required
            />
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Kısaltma"
              value={formData.shortName}
              onChange={(value) => setFormData({ ...formData, shortName: value })}
              placeholder="Örn: AY"
            />
            
            <Select
              label="Rütbe"
              value={formData.rank}
              onChange={(value) => setFormData({ ...formData, rank: value })}
              options={rankOptions}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Cinsiyet"
              value={formData.gender}
              onChange={(value) => setFormData({ ...formData, gender: value })}
              options={genderOptions}
            />
            
            <Input
              label="Ünvan"
              value={formData.title}
              onChange={(value) => setFormData({ ...formData, title: value })}
              placeholder="Örn: Sınıf Öğretmeni"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="İşim son eki"
              value={formData.lastAddition}
              onChange={(value) => setFormData({ ...formData, lastAddition: value })}
              placeholder=""
            />
            
            <Input
              label="Derslikler"
              value={formData.classrooms}
              onChange={(value) => setFormData({ ...formData, classrooms: value })}
              placeholder="Örn: A101, B205"
            />
          </div>

          <Input
            label="Numara"
            value={formData.phoneNumber}
            onChange={(value) => setFormData({ ...formData, phoneNumber: value })}
            placeholder="Örn: 0555 123 45 67"
          />

          {/* Branch and Level for system compatibility */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Branş"
              value={formData.branch}
              onChange={(value) => setFormData({ ...formData, branch: value })}
              placeholder="Örn: Matematik, Türkçe"
            />
            
            <Select
              label="Eğitim Seviyesi"
              value={formData.level}
              onChange={(value) => setFormData({ ...formData, level: value })}
              options={levelOptions}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
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
              {editingTeacher ? 'Güncelle' : 'Tamamla'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WizardStepTeachers;