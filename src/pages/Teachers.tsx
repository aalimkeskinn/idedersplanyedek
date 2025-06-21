import React, { useState } from 'react';
import { Plus, Edit, Trash2, Users, Search, X } from 'lucide-react';
import { Teacher, EDUCATION_LEVELS, Subject } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { useToast } from '../hooks/useToast';
import { useConfirmation } from '../hooks/useConfirmation';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import ConfirmationModal from '../components/UI/ConfirmationModal';

const Teachers = () => {
  const { data: teachers, loading, add, update, remove } = useFirestore<Teacher>('teachers');
  const { data: subjects } = useFirestore<Subject>('subjects');
  const { success, error, warning } = useToast();
  const { 
    confirmation, 
    showConfirmation, 
    hideConfirmation,
    confirmDelete 
  } = useConfirmation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [levelFilter, setLevelFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [bulkTeachers, setBulkTeachers] = useState([
    { name: '', branch: '', level: '' }
  ]);
  const [formData, setFormData] = useState({
    name: '',
    branch: '', // Single branch selection
    levels: [] as ('Anaokulu' | 'İlkokul' | 'Ortaokul')[], // Multiple level selection
    selectedSubjects: [] as string[], // Multiple subject selection
  });

  // Get unique branches from subjects
  const getUniqueBranches = () => {
    const branches = [...new Set(subjects.map(subject => subject.branch))];
    return branches.sort((a, b) => a.localeCompare(b, 'tr'));
  };

  // Filter teachers
  const getFilteredTeachers = () => {
    return teachers.filter(teacher => {
      // Check if teacher has the selected level (either in legacy level field or new levels array)
      const matchesLevel = !levelFilter || 
        teacher.level === levelFilter || 
        (teacher.levels && teacher.levels.includes(levelFilter as any));
      
      // Check if teacher has the selected branch (either in legacy branch field or new branches array)
      const matchesBranch = !branchFilter || 
        teacher.branch === branchFilter || 
        teacher.branch.includes(branchFilter) ||
        (teacher.branches && teacher.branches.includes(branchFilter));
      
      const matchesSearch = !searchQuery || 
        teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.branch.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesLevel && matchesBranch && matchesSearch;
    });
  };

  const sortedTeachers = getFilteredTeachers().sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  // Delete all teachers function
  const handleDeleteAllTeachers = () => {
    if (teachers.length === 0) {
      warning('⚠️ Silinecek Öğretmen Yok', 'Sistemde silinecek öğretmen bulunamadı');
      return;
    }

    confirmDelete(
      `${teachers.length} Öğretmen`,
      async () => {
        setIsDeletingAll(true);
        
        try {
          let deletedCount = 0;
          
          console.log('🗑️ Tüm öğretmenler siliniyor:', {
            totalTeachers: teachers.length
          });

          // Delete each teacher
          for (const teacher of teachers) {
            try {
              await remove(teacher.id);
              deletedCount++;
              console.log(`✅ Öğretmen silindi: ${teacher.name}`);
            } catch (err) {
              console.error(`❌ Öğretmen silinemedi: ${teacher.name}`, err);
            }
          }

          if (deletedCount > 0) {
            success('🗑️ Öğretmenler Silindi', `${deletedCount} öğretmen başarıyla silindi`);
            
            // Reset filters and search
            setLevelFilter('');
            setBranchFilter('');
            setSearchQuery('');
          } else {
            error('❌ Silme Hatası', 'Hiçbir öğretmen silinemedi');
          }

        } catch (err) {
          console.error('❌ Toplu silme hatası:', err);
          error('❌ Silme Hatası', 'Öğretmenler silinirken bir hata oluştu');
        } finally {
          setIsDeletingAll(false);
        }
      }
    );
  };

  // Handle form submission with single branch and multiple levels
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.branch) {
      error('❌ Branş Seçimi Gerekli', 'Bir branş seçmelisiniz');
      return;
    }

    if (formData.levels.length === 0) {
      error('❌ Eğitim Seviyesi Gerekli', 'En az bir eğitim seviyesi seçmelisiniz');
      return;
    }

    try {
      // Create teacher data with both legacy and new fields
      const teacherData = {
        name: formData.name,
        branch: formData.branch, // Single branch
        level: formData.levels[0], // Legacy field - use first selected level
        levels: formData.levels, // New field - array
        selectedSubjects: formData.selectedSubjects, // Store selected subjects
      };

      if (editingTeacher) {
        await update(editingTeacher.id, teacherData);
        success('✅ Öğretmen Güncellendi', `${formData.name} başarıyla güncellendi`);
      } else {
        await add(teacherData as Omit<Teacher, 'id' | 'createdAt'>);
        success('✅ Öğretmen Eklendi', `${formData.name} başarıyla eklendi`);
      }
      resetForm();
    } catch (err) {
      error('❌ Hata', 'Öğretmen kaydedilirken bir hata oluştu');
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    for (const teacher of bulkTeachers) {
      if (teacher.name && teacher.branch && teacher.level) {
        if (EDUCATION_LEVELS.includes(teacher.level as any)) {
          await add({
            name: teacher.name,
            branch: teacher.branch,
            level: teacher.level as Teacher['level'],
            levels: [teacher.level as 'Anaokulu' | 'İlkokul' | 'Ortaokul'],
            selectedSubjects: []
          } as Omit<Teacher, 'id' | 'createdAt'>);
        }
      }
    }
    
    setBulkTeachers([{ name: '', branch: '', level: '' }]);
    setIsBulkModalOpen(false);
    success('✅ Öğretmenler Eklendi', `${bulkTeachers.filter(t => t.name && t.branch && t.level).length} öğretmen başarıyla eklendi`);
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      branch: '', 
      levels: [],
      selectedSubjects: []
    });
    setEditingTeacher(null);
    setIsModalOpen(false);
  };

  const handleEdit = (teacher: Teacher) => {
    // Initialize form data with both legacy and new fields
    const levelsArray = teacher.levels || [teacher.level];
    
    setFormData({
      name: teacher.name,
      branch: teacher.branch,
      levels: levelsArray,
      selectedSubjects: teacher.selectedSubjects || []
    });
    setEditingTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const teacher = teachers.find(t => t.id === id);
    if (teacher) {
      confirmDelete(
        teacher.name,
        async () => {
          await remove(id);
          success('🗑️ Öğretmen Silindi', `${teacher.name} başarıyla silindi`);
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

  // Handle subject selection/deselection
  const handleSubjectToggle = (subjectId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedSubjects.includes(subjectId);
      if (isSelected) {
        return {
          ...prev,
          selectedSubjects: prev.selectedSubjects.filter(id => id !== subjectId)
        };
      } else {
        return {
          ...prev,
          selectedSubjects: [...prev.selectedSubjects, subjectId]
        };
      }
    });
  };

  const addBulkRow = () => {
    setBulkTeachers([...bulkTeachers, { name: '', branch: '', level: '' }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkTeachers.length > 1) {
      setBulkTeachers(bulkTeachers.filter((_, i) => i !== index));
    }
  };

  const updateBulkRow = (index: number, field: string, value: string) => {
    const updated = [...bulkTeachers];
    updated[index] = { ...updated[index], [field]: value };
    setBulkTeachers(updated);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // ENTER tuşu desteği
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      console.log('🔍 Enter ile öğretmen araması:', searchQuery);
      const target = e.target as HTMLInputElement;
      target.blur();
    }
    
    if (e.key === 'Escape') {
      clearSearch();
      const target = e.target as HTMLInputElement;
      target.blur();
    }
  };

  // Get display text for teacher levels
  const getTeacherLevelsDisplay = (teacher: Teacher): string[] => {
    if (teacher.levels && teacher.levels.length > 0) {
      return teacher.levels;
    }
    return [teacher.level];
  };

  // Get filtered subjects based on selected branch and levels
  const getFilteredSubjects = () => {
    if (!formData.branch || formData.levels.length === 0) return [];
    
    return subjects.filter(subject => {
      // Check if subject branch matches teacher branch
      const matchesBranch = subject.branch === formData.branch;
      
      // Check if subject level matches any of teacher levels
      const subjectLevels = subject.levels || [subject.level];
      const hasMatchingLevel = formData.levels.some(level => 
        subjectLevels.includes(level)
      );
      
      return matchesBranch && hasMatchingLevel;
    });
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
      {/* CRITICAL: Mobile-optimized header */}
      <div className="header-mobile">
        <div className="flex items-center">
          <Users className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-responsive-xl font-bold text-gray-900">Öğretmenler</h1>
            <p className="text-responsive-sm text-gray-600">{teachers.length} öğretmen kayıtlı ({sortedTeachers.length} gösteriliyor)</p>
          </div>
        </div>
        <div className="button-group-mobile">
          {/* Delete All Button */}
          {teachers.length > 0 && (
            <Button
              onClick={handleDeleteAllTeachers}
              icon={Trash2}
              variant="danger"
              disabled={isDeletingAll}
              className="w-full sm:w-auto"
            >
              {isDeletingAll ? 'Siliniyor...' : `Tümünü Sil (${teachers.length})`}
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
            Yeni Öğretmen
          </Button>
        </div>
      </div>

      {/* FIXED: Mobile-optimized search and filters */}
      <div className="mobile-card mobile-spacing mb-6">
        {/* FIXED: Search with proper styling */}
        <div className="mobile-form-group">
          <label className="mobile-form-label">
            🔍 Öğretmen Ara
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Öğretmen adı veya branş ara... (Enter ile ara)"
              className="block w-full pl-10 pr-10 py-3 text-base border-2 border-gray-300 rounded-lg bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              title="Enter ile ara, ESC ile temizle"
            />
            {searchQuery && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={clearSearch}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Aramayı temizle"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-blue-600">
                🔍 "{searchQuery}" için {sortedTeachers.length} sonuç bulundu
              </p>
              <button
                onClick={clearSearch}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Temizle
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
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

      {sortedTeachers.length === 0 ? (
        <div className="text-center py-12 mobile-card">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {teachers.length === 0 ? 'Henüz öğretmen eklenmemiş' : 
             searchQuery ? 'Arama sonucu bulunamadı' : 'Filtrelere uygun öğretmen bulunamadı'}
          </h3>
          <p className="text-gray-500 mb-4">
            {teachers.length === 0 ? 'İlk öğretmeninizi ekleyerek başlayın' : 
             searchQuery ? `"${searchQuery}" araması için sonuç bulunamadı` : 'Farklı filtre kriterleri deneyin'}
          </p>
          <div className="button-group-mobile">
            {teachers.length === 0 && (
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
                  Öğretmen Ekle
                </Button>
              </>
            )}
            {(searchQuery || levelFilter || branchFilter) && (
              <div className="button-group-mobile">
                {searchQuery && (
                  <Button onClick={clearSearch} variant="secondary">
                    Aramayı Temizle
                  </Button>
                )}
                {(levelFilter || branchFilter) && (
                  <Button 
                    onClick={() => {
                      setLevelFilter('');
                      setBranchFilter('');
                    }} 
                    variant="secondary"
                  >
                    Filtreleri Temizle
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* CRITICAL: Mobile table cards for small screens */}
          <div className="mobile-table-cards">
            {sortedTeachers.map((teacher) => (
              <div key={teacher.id} className="mobile-table-card">
                <div className="mobile-table-card-header">
                  {teacher.name}
                </div>
                <div className="mobile-table-card-row">
                  <span className="mobile-table-card-label">Branş</span>
                  <span className="mobile-table-card-value">{teacher.branch}</span>
                </div>
                <div className="mobile-table-card-row">
                  <span className="mobile-table-card-label">Seviye</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {getTeacherLevelsDisplay(teacher).map((level, index) => (
                      <span key={index} className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        level === 'Anaokulu' ? 'bg-green-100 text-green-800' :
                        level === 'İlkokul' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {level}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mobile-table-card-row">
                  <span className="mobile-table-card-label">İşlemler</span>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleEdit(teacher)}
                      icon={Edit}
                      size="sm"
                      variant="secondary"
                    >
                      Düzenle
                    </Button>
                    <Button
                      onClick={() => handleDelete(teacher.id)}
                      icon={Trash2}
                      size="sm"
                      variant="danger"
                    >
                      Sil
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CRITICAL: Desktop table */}
          <div className="desktop-table mobile-card overflow-hidden">
            <div className="table-responsive">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ad Soyad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branş
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seviye
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{teacher.branch}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {getTeacherLevelsDisplay(teacher).map((level, index) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={() => handleEdit(teacher)}
                            icon={Edit}
                            size="sm"
                            variant="secondary"
                          >
                            Düzenle
                          </Button>
                          <Button
                            onClick={() => handleDelete(teacher.id)}
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
        </>
      )}

      {/* Teacher Modal with Single Branch and Multiple Subject Selection */}
      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingTeacher ? 'Öğretmen Düzenle' : 'Yeni Öğretmen Ekle'}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Ad Soyad"
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            placeholder="Örn: Ahmet Yılmaz"
            required
          />
          
          {/* Single Branch Selection */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Branş <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.branch}
              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Branş Seçin</option>
              {branchOptions.map(branch => (
                <option key={branch.value} value={branch.value}>{branch.label}</option>
              ))}
            </select>
          </div>
          
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
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
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
                    <span className="ml-2 text-blue-600">✓</span>
                  )}
                </label>
              ))}
            </div>
            {formData.levels.length > 0 && (
              <p className="text-xs text-blue-600 mt-2">
                ✨ Seçilen seviyeler: {formData.levels.join(', ')}
              </p>
            )}
          </div>

          {/* Multiple Subject Selection - Only show if branch and levels are selected */}
          {formData.branch && formData.levels.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Verebileceği Dersler
              </label>
              <div className="space-y-2 p-3 border border-gray-300 rounded-lg bg-gray-50 max-h-60 overflow-y-auto">
                {getFilteredSubjects().length > 0 ? (
                  getFilteredSubjects().map((subject) => (
                    <label key={subject.id} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.selectedSubjects.includes(subject.id)}
                        onChange={() => handleSubjectToggle(subject.id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">{subject.name}</span>
                      <span className="text-xs text-gray-500">({subject.level})</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Seçilen branş ve seviyeye uygun ders bulunamadı
                  </p>
                )}
              </div>
              {formData.selectedSubjects.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  ✨ {formData.selectedSubjects.length} ders seçildi
                </p>
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
              disabled={!formData.branch || formData.levels.length === 0}
            >
              {editingTeacher ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Toplu Öğretmen Ekleme"
      >
        <form onSubmit={handleBulkSubmit}>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Öğretmen Listesi
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
              {bulkTeachers.map((teacher, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    placeholder="Ad Soyad"
                    value={teacher.name}
                    onChange={(e) => updateBulkRow(index, 'name', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <select
                    value={teacher.branch}
                    onChange={(e) => updateBulkRow(index, 'branch', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Branş Seçin</option>
                    {branchOptions.map(branch => (
                      <option key={branch.value} value={branch.value}>{branch.label}</option>
                    ))}
                  </select>
                  <select
                    value={teacher.level}
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
                    disabled={bulkTeachers.length === 1}
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Örnek Öğretmenler:</h4>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• Ahmet Yılmaz - Matematik - İlkokul</p>
              <p>• Ayşe Demir - Türkçe - Ortaokul</p>
              <p>• Mehmet Kaya - Fen Bilimleri - İlkokul</p>
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
              Toplu Ekle ({bulkTeachers.filter(t => t.name && t.branch && t.level).length} öğretmen)
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

export default Teachers;