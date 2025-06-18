// --- START OF FILE src/components/Wizard/WizardStepSubjects.tsx ---

import React, { useState } from 'react';
import { BookOpen, Plus, Minus, Edit, Trash2 } from 'lucide-react';
import { Subject, EDUCATION_LEVELS } from '../../types';
import { WizardData } from '../../types/wizard';
import { useFirestore } from '../../hooks/useFirestore';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Modal from '../UI/Modal';
import Input from '../UI/Input';

// Component'in dışarıdan alacağı propları tanımlıyoruz.
interface WizardStepSubjectsProps {
  data: WizardData['subjects']; // Ana sihirbazdan gelen "subjects" verisi
  onUpdate: (data: WizardData['subjects']) => void; // Değişiklikleri ana sihirbaza bildirecek fonksiyon
}

const WizardStepSubjects: React.FC<WizardStepSubjectsProps> = ({ data, onUpdate }) => {
  // Firestore'dan ders listesini çekiyoruz
  const { data: allSubjects, add: addSubject, update: updateSubject, remove: removeSubject } = useFirestore<Subject>('subjects');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({ name: '', branch: '', level: '', weeklyHours: '4' });

  // Filtrelenmiş ve seçilmiş dersleri hesapla
  const filteredSubjects = allSubjects.filter(subject => !selectedLevel || subject.level === selectedLevel);
  const selectedSubjects = allSubjects.filter(subject => data.selectedSubjects.includes(subject.id));

  // --- DERS SEÇME/KALDIRMA FONKSİYONU ---
  const handleSubjectToggle = (subjectId: string) => {
    const isSelected = data.selectedSubjects.includes(subjectId);
    const subject = allSubjects.find(s => s.id === subjectId);
    
    let newSelectedSubjects = data.selectedSubjects;
    let newSubjectHours = { ...data.subjectHours };
    let newSubjectPriorities = { ...data.subjectPriorities };

    if (isSelected) {
      // Dersi seçimden kaldır
      newSelectedSubjects = data.selectedSubjects.filter(id => id !== subjectId);
      delete newSubjectHours[subjectId];
      delete newSubjectPriorities[subjectId];
    } else {
      // Dersi seçime ekle
      newSelectedSubjects = [...data.selectedSubjects, subjectId];
      newSubjectHours[subjectId] = subject?.weeklyHours || 4;
      newSubjectPriorities[subjectId] = 'medium';
    }
    
    // Değişikliği ana sihirbaza bildir
    onUpdate({
      selectedSubjects: newSelectedSubjects,
      subjectHours: newSubjectHours,
      subjectPriorities: newSubjectPriorities
    });
  };

  // --- HAFTALIK SAAT DEĞİŞTİRME FONKSİYONU ---
  const handleHoursChange = (subjectId: string, hours: number) => {
    const validHours = Math.max(1, hours); // Saat 1'den az olamaz
    onUpdate({
      ...data,
      subjectHours: {
        ...data.subjectHours,
        [subjectId]: validHours,
      }
    });
  };

  // --- ÖNCELİK DEĞİŞTİRME FONKSİYONU ---
  const handlePriorityChange = (subjectId: string, priority: 'high' | 'medium' | 'low') => {
    onUpdate({
      ...data,
      subjectPriorities: {
        ...data.subjectPriorities,
        [subjectId]: priority,
      }
    });
  };

  // Toplam haftalık saati hesapla
  const getTotalWeeklyHours = () => {
    return selectedSubjects.reduce((sum, subject) => {
        return sum + (data.subjectHours[subject.id] || subject.weeklyHours);
    }, 0);
  };
  
  // Yeni ders ekleme/düzenleme işlemleri (Bunlar aynı kalabilir)
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); /* ... */ };
  const resetForm = () => { /* ... */ };
  const handleEdit = (subject: Subject) => { /* ... */ };
  const handleDelete = async (id: string) => { /* ... */ };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ders Seçimi ve Konfigürasyonu</h3>
        <p className="text-gray-600">Programa dahil edilecek dersleri seçin ve haftalık saat sayılarını belirleyin</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="md:w-1/2">
          <Select label="Seviye Filtresi" value={selectedLevel} onChange={setSelectedLevel} options={[{ value: '', label: 'Tüm Seviyeler' }, ...EDUCATION_LEVELS.map(l => ({value: l, label: l}))]} />
        </div>
        <Button onClick={() => setIsModalOpen(true)} icon={Plus} variant="primary">Yeni Ders Ekle</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Mevcut Dersler ({filteredSubjects.length})</h4>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {filteredSubjects.map(subject => (
                <div key={subject.id} className={`p-3 rounded-lg border-2 transition-all ${data.selectedSubjects.includes(subject.id) ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{subject.name}</p>
                      <p className="text-xs text-gray-600">{subject.branch} • {subject.level} • {subject.weeklyHours} saat/hafta</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleEdit(subject)} className="p-1 text-gray-400 hover:text-blue-600"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(subject.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      <button onClick={() => handleSubjectToggle(subject.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${data.selectedSubjects.includes(subject.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                        {data.selectedSubjects.includes(subject.id) ? <Minus className="w-3 h-3 text-white" /> : <Plus className="w-3 h-3 text-gray-500" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Seçilen Dersler ({selectedSubjects.length})</h4>
            <div className="text-sm text-gray-600">
              Toplam: <span className="font-bold text-blue-600">{getTotalWeeklyHours()} saat/hafta</span>
            </div>
          </div>
          {selectedSubjects.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center"><BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Henüz ders seçilmedi</p></div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {selectedSubjects.map(subject => (
                  <div key={subject.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{subject.name}</p>
                        <p className="text-xs text-gray-600">{subject.branch} • {subject.level}</p>
                      </div>
                      <button onClick={() => handleSubjectToggle(subject.id)} className="text-red-500 hover:text-red-700 p-1"><Minus className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Haftalık Saat</label>
                        <div className="flex items-center space-x-2">
                          <button type="button" onClick={() => handleHoursChange(subject.id, (data.subjectHours[subject.id] || 0) - 1)} className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300">-</button>
                          <input type="number" min="1" value={data.subjectHours[subject.id] || subject.weeklyHours} onChange={(e) => handleHoursChange(subject.id, parseInt(e.target.value) || 1)} className="w-12 text-center text-sm font-medium border border-gray-300 rounded py-1" />
                          <button type="button" onClick={() => handleHoursChange(subject.id, (data.subjectHours[subject.id] || 0) + 1)} className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Öncelik</label>
                        <select value={data.subjectPriorities[subject.id] || 'medium'} onChange={(e) => handlePriorityChange(subject.id, e.target.value as any)} className="w-full text-xs p-1 border border-gray-300 rounded">
                          <option value="high">Yüksek Öncelik</option>
                          <option value="medium">Orta Öncelik</option>
                          <option value="low">Düşük Öncelik</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WizardStepSubjects;
// --- END OF FILE src/components/Wizard/WizardStepSubjects.tsx ---