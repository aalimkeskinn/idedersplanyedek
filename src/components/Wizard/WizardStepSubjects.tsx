import React, { useState } from 'react';
import { BookOpen, Plus, Minus, Edit, Trash2 } from 'lucide-react';
import { Subject, EDUCATION_LEVELS } from '../../types';
import { WizardData } from '../../types/wizard';
import { useFirestore } from '../../hooks/useFirestore';
import { useToast } from '../../hooks/useToast';
import Button from '../UI/Button';
import Select from '../UI/Select';
import Modal from '../UI/Modal';
import Input from '../UI/Input';

interface WizardStepSubjectsProps {
  data: WizardData['subjects'];
  onUpdate: (data: WizardData['subjects']) => void;
}

const WizardStepSubjects: React.FC<WizardStepSubjectsProps> = ({ data, onUpdate }) => {
  const { data: allSubjects, add: addSubject, update: updateSubject, remove: removeSubject } = useFirestore<Subject>('subjects');
  const { success, error } = useToast();
  const [selectedLevel, setSelectedLevel] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  
  // Subjects.tsx ile aynı form state'i
  const [formData, setFormData] = useState({
    name: '',
    branch: '',
    levels: [] as ('Anaokulu' | 'İlkokul' | 'Ortaokul')[],
    weeklyHours: '4'
  });

  const filteredSubjects = allSubjects.filter(subject => !selectedLevel || (subject.levels || [subject.level]).includes(selectedLevel as any));
  const selectedSubjects = allSubjects.filter(subject => data.selectedSubjects.includes(subject.id));

  const handleSubjectToggle = (subjectId: string) => {
    const isSelected = data.selectedSubjects.includes(subjectId);
    let newSelectedSubjects = data.selectedSubjects;
    let newSubjectHours = { ...data.subjectHours };
    let newSubjectPriorities = { ...data.subjectPriorities };
    
    if (isSelected) {
      newSelectedSubjects = data.selectedSubjects.filter(id => id !== subjectId);
      delete newSubjectHours[subjectId];
      delete newSubjectPriorities[subjectId];
    } else {
      const subject = allSubjects.find(s => s.id === subjectId);
      newSelectedSubjects = [...data.selectedSubjects, subjectId];
      newSubjectHours[subjectId] = subject?.weeklyHours || 4;
      newSubjectPriorities[subjectId] = 'medium';
    }
    onUpdate({ selectedSubjects: newSelectedSubjects, subjectHours: newSubjectHours, subjectPriorities: newSubjectPriorities });
  };

  const handleHoursChange = (subjectId: string, hours: number) => onUpdate({ ...data, subjectHours: { ...data.subjectHours, [subjectId]: Math.max(1, hours) } });
  const handlePriorityChange = (subjectId: string, priority: 'high' | 'medium' | 'low') => onUpdate({ ...data, subjectPriorities: { ...data.subjectPriorities, [subjectId]: priority } });
  const getTotalWeeklyHours = () => selectedSubjects.reduce((sum, subject) => sum + (data.subjectHours[subject.id] || subject.weeklyHours), 0);
  
  const resetForm = () => {
    setFormData({ name: '', branch: '', levels: [], weeklyHours: '4' });
    setEditingSubject(null);
    setIsModalOpen(false);
  };

  // Subjects.tsx ile aynı handleSubmit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.levels.length === 0) {
      error('❌ Eğitim Seviyesi Gerekli', 'En az bir eğitim seviyesi seçmelisiniz');
      return;
    }
    const subjectData = {
      name: formData.name,
      branch: formData.branch,
      level: formData.levels[0],
      levels: formData.levels,
      weeklyHours: parseInt(formData.weeklyHours) || 1
    };
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, subjectData);
        success('✅ Ders Güncellendi', `${formData.name} başarıyla güncellendi`);
      } else {
        await addSubject(subjectData as Omit<Subject, 'id' | 'createdAt'>);
        success('✅ Ders Eklendi', `${formData.name} başarıyla eklendi`);
      }
      resetForm();
    } catch (err) {
      error('❌ Hata', 'Ders kaydedilirken bir hata oluştu');
    }
  };

  const handleEdit = (subject: Subject) => {
    setFormData({ name: subject.name, branch: subject.branch, levels: subject.levels || (subject.level ? [subject.level] : []), weeklyHours: subject.weeklyHours.toString() });
    setEditingSubject(subject);
    setIsModalOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    const subject = allSubjects.find(s => s.id === id);
    if (subject && window.confirm(`${subject.name} dersini silmek istediğinizden emin misiniz?`)) {
      await removeSubject(id);
      success('🗑️ Silindi', `${subject.name} başarıyla silindi`);
      // SİHİRBAZA ÖZEL ADIM: Seçimlerden kaldır
      if(data.selectedSubjects.includes(id)) {
        handleSubjectToggle(id);
      }
    }
  };
  
  const handleLevelToggle = (level: 'Anaokulu' | 'İlkokul' | 'Ortaokul') => {
    setFormData(prev => ({...prev, levels: prev.levels.includes(level) ? prev.levels.filter(l => l !== level) : [...prev.levels, level]}));
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4"><BookOpen className="w-8 h-8 text-indigo-600" /></div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ders Seçimi ve Konfigürasyonu</h3>
        <p className="text-gray-600">Programa dahil edilecek dersleri seçin, düzenleyin veya yeni ders ekleyin.</p>
      </div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="md:w-1/2"><Select label="Seviye Filtresi" value={selectedLevel} onChange={setSelectedLevel} options={[{ value: '', label: 'Tüm Seviyeler' }, ...EDUCATION_LEVELS.map(l => ({value: l, label: l}))]} /></div>
        <Button onClick={() => setIsModalOpen(true)} icon={Plus} variant="primary">Yeni Ders Ekle</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Mevcut Dersler ({filteredSubjects.length})</h4>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto"><div className="space-y-2">{filteredSubjects.map(s => (<div key={s.id} className={`p-3 rounded-lg border-2 transition-all ${data.selectedSubjects.includes(s.id) ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}><div className="flex items-center justify-between"><div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-gray-600">{s.branch} • {(s.levels || [s.level]).join(', ')} • {s.weeklyHours} sa/h</p></div><div className="flex items-center space-x-2"><button onClick={() => handleEdit(s)} className="p-1 text-gray-400 hover:text-blue-600"><Edit size={16} /></button><button onClick={() => handleDelete(s.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button><button onClick={() => handleSubjectToggle(s.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${data.selectedSubjects.includes(s.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>{data.selectedSubjects.includes(s.id) ? <Minus className="w-3 h-3 text-white" /> : <Plus className="w-3 h-3 text-gray-500" />}</button></div></div></div>))}</div></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3"><h4 className="font-medium">Seçilen Dersler ({selectedSubjects.length})</h4><div className="text-sm">Toplam: <span className="font-bold">{getTotalWeeklyHours()} sa/h</span></div></div>
          {selectedSubjects.length === 0 ? <div className="bg-gray-50 rounded-lg p-8 text-center"><p>Henüz ders seçilmedi.</p></div> : <div className="bg-white rounded-lg border p-4 max-h-96 overflow-y-auto"><div className="space-y-3">{selectedSubjects.map(s => (<div key={s.id} className="p-3 bg-gray-50 rounded-lg"><div className="flex items-center justify-between mb-2"><div><p className="font-medium text-sm">{s.name}</p><p className="text-xs">{s.branch} • {(s.levels || [s.level]).join(', ')}</p></div><button onClick={() => handleSubjectToggle(s.id)} className="text-red-500 p-1"><Minus size={16} /></button></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs mb-1 block">Haftalık Saat</label><div className="flex items-center space-x-2"><button type="button" onClick={() => handleHoursChange(s.id, (data.subjectHours[s.id] || 0) - 1)} className="w-6 h-6 bg-gray-200 rounded">-</button><input type="number" min="1" value={data.subjectHours[s.id] || s.weeklyHours} onChange={(e) => handleHoursChange(s.id, parseInt(e.target.value) || 1)} className="w-12 text-center border rounded py-1" /><button type="button" onClick={() => handleHoursChange(s.id, (data.subjectHours[s.id] || 0) + 1)} className="w-6 h-6 bg-gray-200 rounded">+</button></div></div><div><label className="text-xs mb-1 block">Öncelik</label><select value={data.subjectPriorities[s.id] || 'medium'} onChange={(e) => handlePriorityChange(s.id, e.target.value as any)} className="w-full text-xs p-1 border rounded"><option value="high">Yüksek</option><option value="medium">Orta</option><option value="low">Düşük</option></select></div></div></div>))}</div></div>}
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={resetForm} title={editingSubject ? 'Ders Düzenle' : 'Yeni Ders Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Ders Adı" value={formData.name} onChange={v => setFormData({...formData, name: v})} required />
          <Input label="Branş" value={formData.branch} onChange={v => setFormData({...formData, branch: v})} required />
          <div className="mb-4"><label className="block text-sm font-semibold text-gray-800 mb-2">Eğitim Seviyeleri<span className="text-red-500">*</span></label><div className="flex flex-wrap gap-3">{EDUCATION_LEVELS.map(level => (<label key={level} className={`flex items-center p-3 border-2 rounded-lg cursor-pointer ${formData.levels.includes(level) ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-300'}`}><input type="checkbox" checked={formData.levels.includes(level)} onChange={() => handleLevelToggle(level)} className="sr-only" /><span className="text-sm">{level}</span>{formData.levels.includes(level) && <span className="ml-2 text-indigo-600">✓</span>}</label>))}</div></div>
          <Input label="Haftalık Ders Saati" type="number" value={formData.weeklyHours} onChange={v => setFormData({...formData, weeklyHours: v})} required />
          <div className="flex justify-end space-x-3 pt-4"><Button type="button" onClick={resetForm} variant="secondary">İptal</Button><Button type="submit" variant="primary" disabled={formData.levels.length === 0}>{editingSubject ? 'Güncelle' : 'Kaydet'}</Button></div>
        </form>
      </Modal>
    </div>
  );
};

export default WizardStepSubjects;
