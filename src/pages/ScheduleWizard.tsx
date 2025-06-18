// --- START OF FILE src/pages/ScheduleWizard.tsx ---

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Calendar, 
  Save, 
  Play,
  AlertTriangle,
  Clock,
  Users,
  Building,
  BookOpen,
  MapPin,
  Settings,
  Zap
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFirestore } from '../hooks/useFirestore';
import { useToast } from '../hooks/useToast';
import Button from '../components/UI/Button';
import WizardStepBasicInfo from '../components/Wizard/WizardStepBasicInfo';
import WizardStepSubjects from '../components/Wizard/WizardStepSubjects';
import WizardStepClasses from '../components/Wizard/WizardStepClasses';
import WizardStepClassrooms from '../components/Wizard/WizardStepClassrooms';
import WizardStepTeachers from '../components/Wizard/WizardStepTeachers';
import WizardStepConstraints from '../components/Wizard/WizardStepConstraints';
import WizardStepGeneration from '../components/Wizard/WizardStepGeneration';
import { Teacher, Class, Subject, Schedule } from '../types';
import { TimeConstraint } from '../types/constraints';

// --- YENİ EKLENEN IMPORTLAR ---
// Yeni oluşturduğumuz akıllı algoritma fonksiyonlarını ve tipleri import ediyoruz.
import { createSubjectTeacherMappings } from '../utils/subjectTeacherMapping';
import { generateSystematicSchedule } from '../utils/scheduleGeneration';
import { WizardData, ScheduleTemplate } from '../types/wizard';
// ------------------------------

// Define wizard steps
const WIZARD_STEPS = [
  { id: 'basic-info', title: 'Temel Bilgiler', description: 'Program adı ve dönem bilgileri', icon: '📝' },
  { id: 'subjects', title: 'Dersler', description: 'Ders seçimi ve haftalık saatler', icon: '📚' },
  { id: 'classes', title: 'Sınıflar', description: 'Sınıf seçimi ve kapasiteler', icon: '🏫' },
  { id: 'classrooms', title: 'Derslikler', description: 'Derslik yönetimi ve atamalar', icon: '🚪' },
  { id: 'teachers', title: 'Öğretmenler', description: 'Öğretmen seçimi ve ders yükleri', icon: '👨‍🏫' },
  { id: 'constraints', title: 'Kısıtlamalar', description: 'Zaman kısıtlamaları ve kurallar', icon: '⏰' },
  { id: 'generation', title: 'Program Oluştur', description: 'Otomatik program oluşturma', icon: '⚡' }
];

const ScheduleWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: teachers } = useFirestore<Teacher>('teachers');
  const { data: classes } = useFirestore<Class>('classes');
  const { data: subjects } = useFirestore<Subject>('subjects');
  const { add: addTemplate, update: updateTemplate, data: templates } = useFirestore<ScheduleTemplate>('schedule-templates');
  const { add: addSchedule, data: existingSchedules, remove: removeSchedule } = useFirestore<Schedule>('schedules');
  const { data: constraints } = useFirestore<TimeConstraint>('constraints');
  const { success, error, warning, info } = useToast();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [wizardData, setWizardData] = useState<WizardData>({
    basicInfo: {
      name: '', academicYear: '2024/2025', semester: '', startDate: '2024-09-01', endDate: '2025-08-31',
      description: '', institutionTitle: '', dailyHours: 8, weekDays: 5, weekendClasses: false
    },
    subjects: { selectedSubjects: [], subjectHours: {}, subjectPriorities: {} },
    classes: { selectedClasses: [], classCapacities: {}, classPreferences: {} },
    classrooms: [],
    teachers: { selectedTeachers: [], teacherSubjects: {}, teacherMaxHours: {}, teacherPreferences: {} },
    constraints: {
      timeConstraints: [],
      globalRules: {
        maxDailyHoursTeacher: 8, maxDailyHoursClass: 9, maxConsecutiveHours: 3, avoidConsecutiveSameSubject: true,
        preferMorningHours: true, avoidFirstLastPeriod: false, lunchBreakRequired: true, lunchBreakDuration: 1
      }
    },
    generationSettings: {
      algorithm: 'balanced', prioritizeTeacherPreferences: true, prioritizeClassPreferences: true,
      allowOverlaps: false, generateMultipleOptions: true, optimizationLevel: 'balanced'
    }
  });

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load a template from URL if `templateId` is present
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const templateId = urlParams.get('templateId');
    if (templateId && templates.length > 0) {
      const template = templates.find(t => t.id === templateId);
      if (template && template.wizardData) {
        setEditingTemplateId(templateId);
        setWizardData(template.wizardData);
        // Mark steps as completed based on loaded data
        const newCompletedSteps = new Set<number>();
        if (template.wizardData.basicInfo?.name) newCompletedSteps.add(0);
        if (template.wizardData.subjects?.selectedSubjects?.length > 0) newCompletedSteps.add(1);
        if (template.wizardData.classes?.selectedClasses?.length > 0) newCompletedSteps.add(2);
        if (template.wizardData.classrooms?.length > 0) newCompletedSteps.add(3);
        if (template.wizardData.teachers?.selectedTeachers?.length > 0) newCompletedSteps.add(4);
        setCompletedSteps(newCompletedSteps);
        success('Şablon Yüklendi', `'${template.name}' düzenleniyor.`);
      }
    }
  }, [location.search, templates, success]);

  // Automatically select teachers assigned to chosen classes
  useEffect(() => {
    if (currentStepIndex === 4) { // Teachers step
      const selectedClassIds = wizardData.classes.selectedClasses;
      if (selectedClassIds.length > 0) {
        const selectedClasses = classes.filter(c => selectedClassIds.includes(c.id));
        const teacherIdsFromClasses = new Set<string>();
        selectedClasses.forEach(classItem => {
          (classItem.teacherIds || []).forEach(id => teacherIdsFromClasses.add(id));
          if (classItem.classTeacherId) teacherIdsFromClasses.add(classItem.classTeacherId);
        });
        if (teacherIdsFromClasses.size > 0) {
          const updatedSelectedTeachers = Array.from(new Set([...wizardData.teachers.selectedTeachers, ...Array.from(teacherIdsFromClasses)]));
          if (updatedSelectedTeachers.length > wizardData.teachers.selectedTeachers.length) {
            setWizardData(prev => ({...prev, teachers: {...prev.teachers, selectedTeachers: updatedSelectedTeachers}}));
            info('Öğretmenler Otomatik Seçildi', `Seçilen sınıflara atanmış öğretmenler listeye eklendi.`);
          }
        }
      }
    }
  }, [currentStepIndex, wizardData.classes.selectedClasses, classes, info]);

  const currentStep = WIZARD_STEPS[currentStepIndex];

  const validateCurrentStep = (): boolean => {
    switch (currentStep.id) {
      case 'basic-info': return !!(wizardData.basicInfo.name && wizardData.basicInfo.academicYear);
      case 'subjects': return wizardData.subjects.selectedSubjects.length > 0;
      case 'classes': return wizardData.classes.selectedClasses.length > 0;
      case 'classrooms': return wizardData.classrooms.length > 0;
      case 'teachers': return wizardData.teachers.selectedTeachers.length > 0;
      default: return true;
    }
  };
  
  const handleNext = () => { if (validateCurrentStep()) { setCompletedSteps(prev => new Set([...prev, currentStepIndex])); if (currentStepIndex < WIZARD_STEPS.length - 1) { setCurrentStepIndex(currentStepIndex + 1); } } else { warning('⚠️ Eksik Bilgi', 'Lütfen gerekli alanları doldurun'); } };
  const handlePrevious = () => { if (currentStepIndex > 0) { setCurrentStepIndex(currentStepIndex - 1); } };
  const handleStepClick = (stepIndex: number) => { if (completedSteps.has(stepIndex) || stepIndex <= currentStepIndex) { setCurrentStepIndex(stepIndex); } };
  
  const handleSaveTemplate = async () => {
    if (!wizardData.basicInfo.name) { warning('⚠️ Program Adı Gerekli', 'Lütfen program adını girin'); return; }
    setIsSaving(true);
    try {
      const templateData = { name: wizardData.basicInfo.name, description: wizardData.basicInfo.description, academicYear: wizardData.basicInfo.academicYear, semester: wizardData.basicInfo.semester, updatedAt: new Date(), wizardData, status: 'draft' as const, generatedSchedules: [] };
      if (editingTemplateId) {
        await updateTemplate(editingTemplateId, templateData);
        success('✅ Şablon Güncellendi', `'${templateData.name}' başarıyla güncellendi`);
      } else {
        const result = await addTemplate(templateData as Omit<ScheduleTemplate, 'id'>);
        if(result.success && result.id) setEditingTemplateId(result.id);
        success('✅ Şablon Kaydedildi', `'${templateData.name}' başarıyla kaydedildi`);
      }
    } catch (err) { error('❌ Kayıt Hatası', 'Şablon kaydedilirken bir hata oluştu'); } finally { setIsSaving(false); }
  };

  const updateWizardData = (stepId: string, stepData: any) => {
    setWizardData(prev => ({ ...prev, [stepId.replace('-','_')]: stepData }));
  };
  
  const handleSelectedTeachersChange = (selectedTeacherIds: string[]) => {
    setWizardData(prev => ({ ...prev, teachers: { ...prev.teachers, selectedTeachers: selectedTeacherIds } }));
  };

  /**
   * Program oluşturma sürecini başlatan ana fonksiyon.
   * Planlama, oluşturma ve kaydetme adımlarını yönetir.
   */
  const handleGenerateSchedule = async () => {
    if (isGenerating) return;

    if ((wizardData.teachers?.selectedTeachers?.length ?? 0) === 0 || 
        (wizardData.classes?.selectedClasses?.length ?? 0) === 0 ||
        (wizardData.subjects?.selectedSubjects?.length ?? 0) === 0) {
      error("Eksik Bilgi", "Devam etmek için en az bir öğretmen, sınıf ve ders seçmelisiniz.");
      return;
    }

    setIsGenerating(true);
    info("Program Oluşturuluyor...", "Bu işlem birkaç dakika sürebilir. Lütfen bekleyin.");

    try {
      // Adım 1: Planlama - Ders-öğretmen eşleştirmelerini (görev listesini) oluştur.
      const { mappings, errors: mappingErrors } = createSubjectTeacherMappings(wizardData, teachers, classes, subjects);

      if (mappingErrors.length > 0) {
        error("Planlama Hatası", `Program oluşturulamadı:\n- ${mappingErrors.join('\n- ')}`);
        setIsGenerating(false);
        return;
      }
      
      // Adım 2: Oluşturma - Sistematik olarak programı oluştur.
      const result = generateSystematicSchedule(mappings, teachers, classes, subjects, wizardData.constraints.timeConstraints);

      if (!result.success || result.schedules.length === 0) {
        error("Oluşturma Hatası", "Program oluşturulurken bir hata oluştu veya hiç ders atanamadı. Lütfen seçimlerinizi ve kısıtlamalarınızı kontrol edin.");
        setIsGenerating(false);
        return;
      }
      
      // Adım 3: Sonuçları Kullanıcıya Bildirme
      if (result.statistics.unassignedLessons.length > 0) {
        const warningMessage = result.statistics.unassignedLessons
          .map(ul => `'${ul.className}' > '${ul.subjectName}': ${ul.missingHours} saat eksik`)
          .join('\n');
        warning("Eksik Dersler", `Bazı dersler yerleştirilemedi:\n${warningMessage}`);
      }

      // Adım 4: Firestore'a Kaydetme
      const teacherIdsInNewSchedule = new Set(result.schedules.map(s => s.teacherId));
      const schedulesToDelete = existingSchedules.filter(s => teacherIdsInNewSchedule.has(s.teacherId));
      
      for (const schedule of schedulesToDelete) { await removeSchedule(schedule.id); }
      for (const schedule of result.schedules) { await addSchedule(schedule as Omit<Schedule, 'id' | 'createdAt'>); }

      success('🎉 Program Başarıyla Oluşturuldu!', `${result.schedules.length} öğretmen için yeni program kaydedildi.`);
      await handleSaveTemplate();
      
      setTimeout(() => navigate('/all-schedules'), 2000);

    } catch (err) {
      console.error("Program oluşturma sırasında kritik hata:", err);
      error("Kritik Hata", "Beklenmedik bir hata oluştu. Lütfen konsolu kontrol edin.");
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'basic-info': return (<WizardStepBasicInfo data={wizardData.basicInfo} onUpdate={(data) => updateWizardData('basicInfo', data)} />);
      case 'subjects': return (<WizardStepSubjects data={wizardData.subjects} onUpdate={(data) => updateWizardData('subjects', data)} />);
      case 'classes': return (<WizardStepClasses data={wizardData} onUpdate={(data) => { if (data.classes) { updateWizardData('classes', data.classes); } }} classes={classes} />);
      case 'classrooms': return (<WizardStepClassrooms data={wizardData} onUpdate={(data) => { if (data.classrooms) { updateWizardData('classrooms', data.classrooms); } }} />);
      case 'teachers': return (<WizardStepTeachers selectedTeachers={wizardData.teachers.selectedTeachers} onSelectedTeachersChange={handleSelectedTeachersChange} />);
      case 'constraints': return (<WizardStepConstraints data={wizardData} onUpdate={(data) => { if (data.constraints) { updateWizardData('constraints', data.constraints); } }} teachers={teachers} classes={classes} subjects={subjects} />);
      case 'generation': return (<WizardStepGeneration data={wizardData.generationSettings} wizardData={wizardData} onUpdate={(data) => updateWizardData('generationSettings', data)} onGenerate={handleGenerateSchedule} isGenerating={isGenerating} />);
      default: return <div>Bilinmeyen adım</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Zap className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {editingTemplateId ? 'Program Düzenleme' : 'Program Oluşturma Sihirbazı'}
                </h1>
                <p className="text-sm text-gray-600">
                  {`Adım ${currentStepIndex + 1}: ${currentStep.title}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button onClick={handleSaveTemplate} icon={Save} variant="secondary" disabled={isSaving || !wizardData.basicInfo.name}>
                {isSaving ? 'Kaydediliyor...' : 'Şablonu Kaydet'}
              </Button>
              <Button onClick={() => navigate('/')} variant="secondary">İptal</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Adımlar</h3>
              <div className="space-y-2">
                {WIZARD_STEPS.map((step, index) => {
                  const isCompleted = completedSteps.has(index);
                  const isCurrent = index === currentStepIndex;
                  const isAccessible = completedSteps.has(index) || isCurrent || completedSteps.has(index - 1);
                  return (
                    <button key={step.id} onClick={() => handleStepClick(index)} disabled={!isAccessible}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                        isCurrent ? 'bg-blue-50 border-blue-400' :
                        isCompleted ? 'bg-green-50 border-green-300' :
                        isAccessible ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isCurrent ? 'bg-blue-500' : isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}>
                          {isCompleted ? <Check size={18} /> : <span>{index + 1}</span>}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{step.title}</p>
                          <p className="text-xs text-gray-500 truncate">{step.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">{currentStep.icon}</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{currentStep.title}</h2>
                            <p className="text-gray-600">{currentStep.description}</p>
                        </div>
                    </div>
                    {!validateCurrentStep() && (<div className="flex items-center text-amber-600"><AlertTriangle className="w-5 h-5 mr-2" /><span className="text-sm font-medium">Eksik bilgi</span></div>)}
                </div>
              </div>
              <div className="p-6">{renderStepContent()}</div>
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <Button onClick={handlePrevious} icon={ChevronLeft} variant="secondary" disabled={currentStepIndex === 0}>Önceki</Button>
                  {currentStepIndex < WIZARD_STEPS.length - 1 ? (
                    <Button onClick={handleNext} icon={ChevronRight} variant="primary" disabled={!validateCurrentStep()}>Sonraki</Button>
                  ) : (
                    <Button onClick={handleGenerateSchedule} icon={Play} variant="primary" disabled={!validateCurrentStep() || isGenerating} size="lg">
                      {isGenerating ? 'Program Oluşturuluyor...' : 'Program Oluştur ve Kaydet'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleWizard;
// --- END OF FILE src/pages/ScheduleWizard.tsx ---