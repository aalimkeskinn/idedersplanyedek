import React, { useState } from 'react';
import { Zap, Settings, Play, CheckCircle, AlertTriangle, BarChart3, Clock } from 'lucide-react';
import { WizardData } from '../../types/wizard';
import Button from '../UI/Button';
import { Teacher, Class, Subject } from '../../types';

// GÜNCELLENDİ: Props arayüzü, tam veri listelerini alacak şekilde güncellendi.
interface WizardStepGenerationProps {
  data: WizardData['generationSettings'];
  wizardData: WizardData;
  onUpdate: (data: WizardData['generationSettings']) => void;
  onGenerate: () => void; // Ana fonksiyona referans
  isGenerating: boolean;  // Üst bileşenden gelen durum
  // EKLENDİ: Özet ve tahmin için tam veri listeleri
  teachers: Teacher[];
  classes: Class[];
  subjects: Subject[];
}

const WizardStepGeneration: React.FC<WizardStepGenerationProps> = ({
  data,
  wizardData,
  onUpdate,
  onGenerate, // GÜNCELLENDİ: Artık doğrudan bu fonksiyonu kullanacağız.
  isGenerating, // GÜNCELLENDİ: Artık doğrudan bu prop'u kullanacağız.
  teachers,   // EKLENDİ
  classes,    // EKLENDİ
  subjects    // EKLENDİ
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const algorithmOptions = [
    { value: 'balanced', label: 'Dengeli Dağılım', description: 'Öğretmen ve sınıf yüklerini eşit dağıtır' },
    { value: 'compact', label: 'Kompakt Program', description: 'Dersleri mümkün olduğunca sıkıştırır' },
    { value: 'distributed', label: 'Dağıtılmış Program', description: 'Dersleri hafta boyunca eşit dağıtır' }
  ];

  const optimizationOptions = [
    { value: 'fast', label: 'Hızlı (1-2 dakika)', description: 'Temel optimizasyon, hızlı sonuç' },
    { value: 'balanced', label: 'Dengeli (3-5 dakika)', description: 'İyi kalite ve makul süre' },
    { value: 'thorough', label: 'Kapsamlı (5-10 dakika)', description: 'En iyi kalite, uzun süre' }
  ];

  const handleChange = (field: keyof WizardData['generationSettings'], value: any) => {
    onUpdate({ ...data, [field]: value });
  };

  const getValidationSummary = () => {
    const issues = [];
    const warnings = [];
    if (!wizardData.subjects?.selectedSubjects || wizardData.subjects.selectedSubjects.length === 0) issues.push('Hiç ders seçilmemiş');
    if (!wizardData.classes?.selectedClasses || wizardData.classes.selectedClasses.length === 0) issues.push('Hiç sınıf seçilmemiş');
    if (!wizardData.teachers?.selectedTeachers || wizardData.teachers.selectedTeachers.length === 0) issues.push('Hiç öğretmen seçilmemiş');
    
    if (!wizardData.classrooms || wizardData.classrooms.length === 0) warnings.push('Hiç derslik seçilmemiş (isteğe bağlı)');
    
    const totalHours = wizardData.subjects?.subjectHours ? Object.values(wizardData.subjects.subjectHours).reduce((sum, hours) => sum + hours, 0) : 0;
    if (totalHours > 45) warnings.push('Haftalık toplam ders saati çok yüksek (45+ saat)');
    
    return { issues, warnings };
  };

  const { issues, warnings } = getValidationSummary();
  const canGenerate = issues.length === 0;

  const getEstimatedTime = () => {
    const baseTime = { fast: 2, balanced: 4, thorough: 8 }[data.optimizationLevel || 'balanced'];
    const subjectCount = wizardData.subjects?.selectedSubjects?.length || 0;
    const classCount = wizardData.classes?.selectedClasses?.length || 0;
    const teacherCount = wizardData.teachers?.selectedTeachers?.length || 0;
    const complexity = subjectCount * classCount * teacherCount;
    const multiplier = complexity > 100 ? 1.5 : complexity > 50 ? 1.2 : 1;
    return Math.round(baseTime * multiplier);
  };
  
  const currentData = {
    algorithm: 'balanced', optimizationLevel: 'balanced', prioritizeTeacherPreferences: true,
    prioritizeClassPreferences: true, generateMultipleOptions: false, allowOverlaps: false, ...data
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4"><Zap className="w-8 h-8 text-purple-600" /></div>
        <h3 className="text-lg font-semibold text-gray-900">Program Oluşturma ve Optimizasyon</h3>
        <p className="text-gray-600">Algoritma ayarlarını yapın ve otomatik program oluşturmayı başlatın.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center"><BarChart3 className="w-5 h-5 mr-2 text-blue-600" />Hazırlık Durumu</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-600">{wizardData.subjects?.selectedSubjects?.length || 0}</div><div className="text-xs text-blue-700">Ders</div></div>
          <div className="text-center p-3 bg-emerald-50 rounded-lg"><div className="text-2xl font-bold text-emerald-600">{wizardData.classes?.selectedClasses?.length || 0}</div><div className="text-xs text-emerald-700">Sınıf</div></div>
          <div className="text-center p-3 bg-indigo-50 rounded-lg"><div className="text-2xl font-bold text-indigo-600">{wizardData.teachers?.selectedTeachers?.length || 0}</div><div className="text-xs text-indigo-700">Öğretmen</div></div>
          <div className="text-center p-3 bg-purple-50 rounded-lg"><div className="text-2xl font-bold text-purple-600">{wizardData.classrooms?.length || 0}</div><div className="text-xs text-purple-700">Derslik</div></div>
        </div>
        {issues.length > 0 && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"><div className="flex items-start space-x-2"><AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" /><div><h5 className="font-medium text-red-800 mb-1">Kritik Sorunlar:</h5><ul className="text-sm text-red-700 space-y-1">{issues.map((issue, i) => <li key={i}>• {issue}</li>)}</ul></div></div></div>}
        {warnings.length > 0 && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"><div className="flex items-start space-x-2"><AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" /><div><h5 className="font-medium text-yellow-800 mb-1">Uyarılar:</h5><ul className="text-sm text-yellow-700 space-y-1">{warnings.map((w, i) => <li key={i}>• {w}</li>)}</ul></div></div></div>}
        {canGenerate && <div className="p-3 bg-green-50 border border-green-200 rounded-lg"><div className="flex items-center space-x-2"><CheckCircle className="w-5 h-5 text-green-600" /><span className="font-medium text-green-800">Tüm gereksinimler karşılandı! Program oluşturmaya hazır.</span></div></div>}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center"><Settings className="w-5 h-5 mr-2 text-purple-600" />Algoritma Ayarları</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Program Türü</label>
            <div className="space-y-2">{algorithmOptions.map(option => (<label key={option.value} className="flex items-start space-x-3 cursor-pointer"><input type="radio" name="algorithm" value={option.value} checked={currentData.algorithm === option.value} onChange={(e) => handleChange('algorithm', e.target.value)} className="mt-1" /><div><div className="font-medium text-sm">{option.label}</div><div className="text-xs text-gray-600">{option.description}</div></div></label>))}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Optimizasyon Seviyesi</label>
            <div className="space-y-2">{optimizationOptions.map(option => (<label key={option.value} className="flex items-start space-x-3 cursor-pointer"><input type="radio" name="optimization" value={option.value} checked={currentData.optimizationLevel === option.value} onChange={(e) => handleChange('optimizationLevel', e.target.value)} className="mt-1" /><div><div className="font-medium text-sm">{option.label}</div><div className="text-xs text-gray-600">{option.description}</div></div></label>))}</div>
          </div>
          <div>
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">{showAdvanced ? 'Gelişmiş ayarları gizle' : 'Gelişmiş ayarları göster'}</button>
            {showAdvanced && (<div className="mt-4 space-y-3 p-3 bg-gray-50 rounded-lg"><label className="flex items-center space-x-2"><input type="checkbox" checked={currentData.prioritizeTeacherPreferences || false} onChange={(e) => handleChange('prioritizeTeacherPreferences', e.target.checked)} /><span className="text-sm">Öğretmen tercihlerini öncelikle</span></label><label className="flex items-center space-x-2"><input type="checkbox" checked={currentData.prioritizeClassPreferences || false} onChange={(e) => handleChange('prioritizeClassPreferences', e.target.checked)} /><span className="text-sm">Sınıf tercihlerini öncelikle</span></label><label className="flex items-center space-x-2"><input type="checkbox" checked={currentData.generateMultipleOptions || false} onChange={(e) => handleChange('generateMultipleOptions', e.target.checked)} /><span className="text-sm">Birden fazla seçenek oluştur</span></label><label className="flex items-center space-x-2"><input type="checkbox" checked={currentData.allowOverlaps || false} onChange={(e) => handleChange('allowOverlaps', e.target.checked)} /><span className="text-sm">Çakışmalara izin ver (acil durumlar için)</span></label></div>)}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <div className="text-center">
          <h4 className="font-semibold text-gray-900 mb-2">Program Oluşturmaya Hazır!</h4>
          <p className="text-sm text-gray-600 mb-4">Tahmini süre: <span className="font-medium text-purple-600">{getEstimatedTime()} dakika</span></p>
          {isGenerating ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div><span className="text-purple-600 font-medium">Program oluşturuluyor...</span></div>
              <p className="text-xs text-gray-600">Bu işlem birkaç dakika sürebilir. Lütfen sayfayı kapatmayın.</p>
            </div>
          ) : (
            <Button onClick={onGenerate} icon={Play} variant="primary" size="lg" disabled={!canGenerate || isGenerating} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              🎯 Program Oluşturmayı Başlat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WizardStepGeneration;