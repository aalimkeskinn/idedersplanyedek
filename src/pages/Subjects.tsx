import React, { useState } from 'react';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { Subject, EDUCATION_LEVELS } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { useToast } from '../hooks/useToast';
import { useConfirmation } from '../hooks/useConfirmation';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import ConfirmationModal from '../components/UI/ConfirmationModal';

const Subjects = () => {
  const { data: subjects, loading, add, update, remove } = useFirestore<Subject>('subjects');
  const { success, error, warning } = useToast();
  const { 
    confirmation, 
    showConfirmation, 
    hideConfirmation,
    confirmDelete 
  } = useConfirmation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [levelFilter, setLevelFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [bulkSubjects, setBulkSubjects] = useState([
    { name: '', branch: '', level: '', weeklyHours: '' }
  ]);
  const [formData, setFormData] = useState({
    name: '',
    branch: '',
    levels: [] as ('Anaokulu' | 'İlkokul' | 'Ortaokul')[], // Multiple level selection
    weeklyHours: ''
  });

  // Get unique branches from subjects
  const getUniqueBranches = () => {
    const branches = [...new Set(subjects.map(subject => subject.branch))];
    return branches.sort((a, b) => a.localeCompare(b, 'tr'));
  };

  // Filter subjects
  const getFilteredSubjects = () => {
    return subjects.filter(subject => {
      // Check if subject has the selected level (either in legacy level field or new levels array)
      const matchesLevel = !levelFilter || 
        subject.level === levelFilter || 
        (subject.levels && subject.levels.includes(levelFilter as any));
      
      const matchesBranch = !branchFilter || subject.branch === branchFilter;
      
      return matchesLevel && matchesBranch;
    });
  };

  const sortedSubjects = getFilteredSubjects().sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  // Delete all subjects function
  const handleDeleteAllSubjects = () => {
    if (subjects.length === 0) {
      warning('⚠️ Silinecek Ders Yok', 'Sistemde silinecek ders bulunamadı');
      return;
    }

    confirmDelete(
      `${subjects.length} Ders`,
      async () => {
        setIsDeletingAll(true);
        
        try {
          let deletedCount = 0;
          
          console.log('🗑️ Tüm dersler siliniyor:', {
            totalSubjects: subjects.length
          });

          // Delete each subject
          for (const subject of subjects) {
            try {
              await remove(subject.id);
              deletedCount++;
              console.log(`✅ Ders silindi: ${subject.name}`);
            } catch (err) {
              console.error(`❌ Ders silinemedi: ${subject.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Dersler Silindi', `${deletedCount} ders başarıyla silindi`);
            
            // Reset filters
            setLevelFilter('');
            setBranchFilter('');
          } else {
            error('❌ Silme Hatası', 'Hiçbir ders silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Dersler silinirken bir hata oluştu');
        } finally {
          setIsDeletingAll(false);
        }
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.levels.length === 0) {
      error('❌ Eğitim Seviyesi Gerekli', 'En az bir eğitim seviyesi seçmelisiniz');
      return;
    }
    
    const subjectData = {
      name: formData.name,
      branch: formData.branch,
      level: formData.levels[0], // Legacy field - use first selected level
      levels: formData.levels, // New field - array
      weeklyHours: parseInt(formData.weeklyHours)
    };

    try {
      if (editingSubject) {
        await update(editingSubject.id, subjectData);
        success('✅ Ders Güncellendi', `${formData.name} başarıyla güncellendi`);
      } else {
        await add(subjectData as Omit<Subject, 'id' | 'createdAt'>);
        success('✅ Ders Eklendi', `${formData.name} başarıyla eklendi`);
      }
      resetForm();
    } catch (err) {
      error('❌ Hata', 'Ders kaydedilirken bir hata oluştu');
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    for (const subject of bulkSubjects) {
      if (subject.name && subject.branch && subject.level && subject.weeklyHours) {
        if (EDUCATION_LEVELS.includes(subject.level as any) && !isNaN(parseInt(subject.weeklyHours))) {
          await add({
            name: subject.name,
            branch: subject.branch,
            level: subject.level as Subject['level'],
            levels: [subject.level as 'Anaokulu' | 'İlkokul' | 'Ortaokul'],
            weeklyHours: parseInt(subject.weeklyHours)
          } as Omit<Subject, 'id' | 'createdAt'>);
        }
      }
    }
    
    setBulkSubjects([{ name: '', branch: '', level: '', weeklyHours: '' }]);
    setIsBulkModalOpen(false);
    success('✅ Dersler Eklendi', `${bulkSubjects.filter(s => s.name && s.branch && s.level && s.weeklyHours).length} ders başarıyla eklendi`);
  };

  const resetForm = () => {
    setFormData({ name: '', branch: '', levels: [], weeklyHours: '' });
    setEditingSubject(null);
    setIsModalOpen(false);
  };

  const handleEdit = (subject: Subject) => {
    // Initialize form data with both legacy and new fields
    const levelsArray = subject.levels || [subject.level];
    
    setFormData({
      name: subject.name,
      branch: subject.branch,
      levels: levelsArray,
      weeklyHours: subject.weeklyHours.toString()
    });
    setEditingSubject(subject);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (subject) {
      confirmDelete(
        subject.name,
        async () => {
          await remove(id);
          success('🗑️ Ders Silindi', `${subject.name} başarıyla silindi`);
        }
      );
    }
  };

  // Handle level selection/deselection
  const handleLevelToggle = (level: 'Anaokulu' | 'İlkokul' | 'Ortaokul') => {
    setFormData(prev => {
      const isSelected = prev.levels.includes(level);
      if (isSelected) {
        return {
          ...prev,
          levels: prev.levels.filter(l => l !== level)
        };
      } else {
        return {
          ...prev,
          levels: [...prev.levels, level]
        };
      }
    });
  };

  const addBulkRow = () => {
    setBulkSubjects([...bulkSubjects, { name: '', branch: '', level: '', weeklyHours: '' }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkSubjects.length > 1) {
      setBulkSubjects(bulkSubjects.filter((_, i) => i !== index));
    }
  };

  const updateBulkRow = (index: number, field: string, value: string) => {
    const updated = [...bulkSubjects];
    updated[index] = { ...updated[index], [field]: value };
    setBulkSubjects(updated);
  };

  // Get display text for subject levels
  const getSubjectLevelsDisplay = (subject: Subject): string[] => {
    if (subject.levels && subject.levels.length > 0) {
      return subject.levels;
    }
    return [subject.level];
  };

  const levelOptions = EDUCATION_LEVELS.map(level => ({
    value: level,
    label: level
  }));

  const branchOptions = getUniqueBranches().map(branch => ({
    value: branch,
    label: branch
  }));

  const levelFilterOptions = [
    { value: '', label: 'Tüm Seviyeler' },
    ...levelOptions
  ];

  const branchFilterOptions = [
    { value: '', label: 'Tüm Branşlar' },
    ...branchOptions
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
          <BookOpen className="w-8 h-8 text-indigo-600 mr-3" />
          <div>
            <h1 className="text-responsive-xl font-bold text-gray-900">Dersler</h1>
            <p className="text-responsive-sm text-gray-600">{subjects.length} ders kayıtlı ({sortedSubjects.length} gösteriliyor)</p>
          </div>
        </div>
        <div className="button-group-mobile">
          {/* NEW: Delete All Button */}
          {subjects.length > 0 && (
            <Button
              onClick={handleDeleteAllSubjects}
              icon={Trash2}
              variant="danger"
              disabled={isDeletingAll}
              className="w-full sm:w-auto"
            >
              {isDeletingAll ? 'Siliniyor...' : `Tümünü Sil (${subjects.length})`}
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
            Yeni Ders
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mobile-card mobile-spacing mb-6">
        <div className="responsive-grid-2 gap-responsive">
          <Select
            label="Seviye Filtresi"
            value={levelFilter}
            onChange={setLevelFilter}
            options={levelFilterOptions}
          />
          <Select
            label="Branş Filtresi"
            value={branchFilter}
            onChange={setBranchFilter}
            options={branchFilterOptions}
          />
        </div>
      </div>

      {sortedSubjects.length === 0 ? (
        <div className="text-center py-12 mobile-card">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {subjects.length === 0 ? 'Henüz ders eklenmemiş' : 'Filtrelere uygun ders bulunamadı'}
          </h3>
          <p className="text-gray-500 mb-4">
            {subjects.length === 0 ? 'İlk dersinizi ekleyerek başlayın' : 'Farklı filtre kriterleri deneyin'}
          </p>
          <div className="button-group-mobile">
            {subjects.length === 0 && (
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
                  Ders Ekle
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mobile-card overflow-hidden">
          <div className="table-responsive">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ders Adı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branş
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seviye
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Haftalık Saat
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedSubjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{subject.branch}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {getSubjectLevelsDisplay(subject).map((level, index) => (
                          <span key={index} className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            level === 'Anaokulu' ? 'bg-green-100 text-green-800' :
                            level === 'İlkokul' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {level}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{subject.weeklyHours} saat</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button
                          onClick={() => handleEdit(subject)}
                          icon={Edit}
                          size="sm"
                          variant="secondary"
                        >
                          Düzenle
                        </Button>
                        <Button
                          onClick={() => handleDelete(subject.id)}
                          icon={Trash2}
                          size="sm"
                          variant="danger"
                        >
                          Sil
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subject Modal with Multiple Level Selection */}
      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingSubject ? 'Ders Düzenle' : 'Yeni Ders Ekle'}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Ders Adı"
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            placeholder="Örn: Matematik"
            required
          />
          
          <Input
            label="Branş"
            value={formData.branch}
            onChange={(value) => setFormData({ ...formData, branch: value })}
            placeholder="Örn: Fen Bilimleri"
            required
          />
          
          {/* Multiple Level Selection */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Eğitim Seviyeleri <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {EDUCATION_LEVELS.map((level) => (
                <label 
                  key={level} 
                  className={`
                    flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all
                    ${formData.levels.includes(level) 
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={formData.levels.includes(level)}
                    onChange={() => handleLevelToggle(level)}
                    className="sr-only" // Hide the checkbox visually
                  />
                  <span className="text-sm font-medium">{level}</span>
                  {formData.levels.includes(level) && (
                    <span className="ml-2 text-indigo-600">✓</span>
                  )}
                </label>
              ))}
            </div>
            {formData.levels.length > 0 && (
              <p className="text-xs text-indigo-600 mt-2">
                ✨ Seçilen seviyeler: {formData.levels.join(', ')}
              </p>
            )}
          </div>

          <Input
            label="Haftalık Ders Saati"
            type="number"
            value={formData.weeklyHours}
            onChange={(value) => setFormData({ ...formData, weeklyHours: value })}
            placeholder="Örn: 4"
            required
          />

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
              disabled={formData.levels.length === 0}
            >
              {editingSubject ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Toplu Ders Ekleme"
      >
        <form onSubmit={handleBulkSubmit}>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Ders Listesi
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
              {bulkSubjects.map((subject, index) => (
                <div key={index} className="grid grid-cols-5 gap-2 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    placeholder="Ders Adı"
                    value={subject.name}
                    onChange={(e) => updateBulkRow(index, 'name', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Branş"
                    value={subject.branch}
                    onChange={(e) => updateBulkRow(index, 'branch', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <select
                    value={subject.level}
                    onChange={(e) => updateBulkRow(index, 'level', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seviye</option>
                    {EDUCATION_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Saat"
                    value={subject.weeklyHours}
                    onChange={(e) => updateBulkRow(index, 'weeklyHours', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    min="1"
                    max="10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeBulkRow(index)}
                    className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                    disabled={bulkSubjects.length === 1}
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Örnek Dersler:</h4>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• Matematik - Matematik - İlkokul - 5 saat</p>
              <p>• Türkçe - Türkçe - Ortaokul - 6 saat</p>
              <p>• Fen Bilimleri - Fen Bilimleri - İlkokul - 3 saat</p>
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
              Toplu Ekle ({bulkSubjects.filter(s => s.name && s.branch && s.level && s.weeklyHours).length} ders)
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

export default Subjects;