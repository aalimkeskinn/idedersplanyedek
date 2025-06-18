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
    branch: '',
    level: ''
  });

  // Get unique branches from subjects
  const getUniqueBranches = () => {
    const branches = [...new Set(subjects.map(subject => subject.branch))];
    return branches.sort((a, b) => a.localeCompare(b, 'tr'));
  };

  // Filter teachers
  const getFilteredTeachers = () => {
    return teachers.filter(teacher => {
      const matchesLevel = !levelFilter || teacher.level === levelFilter;
      const matchesBranch = !branchFilter || teacher.branch === branchFilter;
      const matchesSearch = !searchQuery || 
        teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.branch.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesLevel && matchesBranch && matchesSearch;
    });
  };

  const sortedTeachers = getFilteredTeachers().sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  // NEW: Delete all teachers function
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTeacher) {
      await update(editingTeacher.id, formData);
    } else {
      await add(formData as Omit<Teacher, 'id' | 'createdAt'>);
    }
    
    resetForm();
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    for (const teacher of bulkTeachers) {
      if (teacher.name && teacher.branch && teacher.level) {
        if (EDUCATION_LEVELS.includes(teacher.level as any)) {
          await add({
            name: teacher.name,
            branch: teacher.branch,
            level: teacher.level as Teacher['level']
          } as Omit<Teacher, 'id' | 'createdAt'>);
        }
      }
    }
    
    setBulkTeachers([{ name: '', branch: '', level: '' }]);
    setIsBulkModalOpen(false);
  };

  const resetForm = () => {
    setFormData({ name: '', branch: '', level: '' });
    setEditingTeacher(null);
    setIsModalOpen(false);
  };

  const handleEdit = (teacher: Teacher) => {
    setFormData({
      name: teacher.name,
      branch: teacher.branch,
      level: teacher.level
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
          {/* NEW: Delete All Button */}
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
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    teacher.level === 'Anaokulu' ? 'bg-green-100 text-green-800' :
                    teacher.level === 'İlkokul' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {teacher.level}
                  </span>
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
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          teacher.level === 'Anaokulu' ? 'bg-green-100 text-green-800' :
                          teacher.level === 'İlkokul' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {teacher.level}
                        </span>
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

      {/* Single Teacher Modal */}
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
          
          <Select
            label="Branş"
            value={formData.branch}
            onChange={(value) => setFormData({ ...formData, branch: value })}
            options={branchOptions}
            required
          />
          
          <Select
            label="Eğitim Seviyesi"
            value={formData.level}
            onChange={(value) => setFormData({ ...formData, level: value })}
            options={levelOptions}
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