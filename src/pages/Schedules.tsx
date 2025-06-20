import React, { useState, useEffect } from 'react';
import { Calendar, Users, BookOpen, Building, Save, RotateCcw, AlertTriangle, X, Check, Filter, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Teacher, Class, Subject, Schedule, DAYS, PERIODS, getTimeForPeriod, formatTimeRange } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { useToast } from '../hooks/useToast';
import { useConfirmation } from '../hooks/useConfirmation';
import { useErrorModal } from '../hooks/useErrorModal';
import { TimeConstraint } from '../types/constraints';
import { checkSlotConflict, validateScheduleWithConstraints } from '../utils/scheduleValidation';
import Button from '../components/UI/Button';
import Select from '../components/UI/Select';
import ScheduleSlotModal from '../components/UI/ScheduleSlotModal';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import ErrorModal from '../components/UI/ErrorModal';

const Schedules = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: teachers } = useFirestore<Teacher>('teachers');
  const { data: classes } = useFirestore<Class>('classes');
  const { data: subjects } = useFirestore<Subject>('subjects');
  const { data: schedules, add: addSchedule, update: updateSchedule } = useFirestore<Schedule>('schedules');
  const { data: timeConstraints } = useFirestore<TimeConstraint>('constraints');
  const { success, error, warning } = useToast();
  const { confirmation, showConfirmation, hideConfirmation, confirmUnsavedChanges } = useConfirmation();
  const { errorModal, showError, hideError } = useErrorModal();

  const [mode, setMode] = useState<'teacher' | 'class'>('teacher');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<Schedule['schedule']>({});
  const [originalSchedule, setOriginalSchedule] = useState<Schedule['schedule']>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // New state for education level and branch selection
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [showScheduleTable, setShowScheduleTable] = useState(false);

  // Check URL parameters for mode and entity ID
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modeParam = params.get('mode');
    const teacherId = params.get('teacherId');
    const classId = params.get('classId');

    if (modeParam === 'class' && classId) {
      setMode('class');
      setSelectedClassId(classId);
    } else if (teacherId) {
      setMode('teacher');
      setSelectedTeacherId(teacherId);
    }
  }, [location]);

  // Initialize schedule when teacher or class is selected
  useEffect(() => {
    if (mode === 'teacher' && selectedTeacherId) {
      const existingSchedule = schedules.find(s => s.teacherId === selectedTeacherId);
      
      if (existingSchedule) {
        setCurrentSchedule(existingSchedule.schedule);
        setOriginalSchedule(JSON.parse(JSON.stringify(existingSchedule.schedule)));
      } else {
        // Create empty schedule
        const emptySchedule: Schedule['schedule'] = {};
        DAYS.forEach(day => {
          emptySchedule[day] = {};
        });
        setCurrentSchedule(emptySchedule);
        setOriginalSchedule(JSON.parse(JSON.stringify(emptySchedule)));
      }
      
      // Reset level and branch selection when teacher changes
      setSelectedLevel('');
      setSelectedBranch('');
      setShowScheduleTable(false);
      
    } else if (mode === 'class' && selectedClassId) {
      // For class mode, we need to construct the schedule from all teacher schedules
      const classSchedule: Schedule['schedule'] = {};
      
      DAYS.forEach(day => {
        classSchedule[day] = {};
      });
      
      // Find all slots where this class is assigned
      schedules.forEach(schedule => {
        DAYS.forEach(day => {
          PERIODS.forEach(period => {
            const slot = schedule.schedule[day]?.[period];
            if (slot?.classId === selectedClassId) {
              if (!classSchedule[day][period]) {
                classSchedule[day][period] = {
                  teacherId: schedule.teacherId,
                  classId: selectedClassId,
                  subjectId: slot.subjectId
                };
              }
            }
          });
        });
      });
      
      setCurrentSchedule(classSchedule);
      setOriginalSchedule(JSON.parse(JSON.stringify(classSchedule)));
    }
  }, [mode, selectedTeacherId, selectedClassId, schedules]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(currentSchedule) !== JSON.stringify(originalSchedule);
    setHasUnsavedChanges(hasChanges);
  }, [currentSchedule, originalSchedule]);

  // Get selected teacher or class
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  const selectedClass = classes.find(c => c.id === selectedClassId);

  // Get teacher levels and branches
  const getTeacherLevels = (teacher: Teacher | undefined): string[] => {
    if (!teacher) return [];
    return teacher.levels || [teacher.level];
  };

  const getTeacherBranches = (teacher: Teacher | undefined): string[] => {
    if (!teacher) return [];
    return teacher.branches || [teacher.branch];
  };

  // Get level and branch options for the selected teacher
  const levelOptions = selectedTeacher 
    ? getTeacherLevels(selectedTeacher).map(level => ({ value: level, label: level }))
    : [];
  
  const branchOptions = selectedTeacher 
    ? getTeacherBranches(selectedTeacher).map(branch => ({ value: branch, label: branch }))
    : [];

  // Check if level and branch are selected
  useEffect(() => {
    if (mode === 'teacher' && selectedTeacherId && selectedLevel && selectedBranch) {
      setShowScheduleTable(true);
    } else {
      setShowScheduleTable(mode === 'class' && !!selectedClassId);
    }
  }, [mode, selectedTeacherId, selectedClassId, selectedLevel, selectedBranch]);

  // Get filtered classes based on selected level and branch
  const getFilteredClasses = () => {
    if (mode !== 'teacher' || !selectedLevel || !selectedBranch) return classes;
    
    return classes.filter(classItem => {
      // Check if class has the selected level (either in legacy level field or new levels array)
      const classLevels = classItem.levels || [classItem.level];
      const matchesLevel = classLevels.includes(selectedLevel as any);
      
      // For branch, we need to check if the subject with this branch exists for this class level
      const matchingSubjects = subjects.filter(subject => {
        const subjectLevels = subject.levels || [subject.level];
        return subject.branch === selectedBranch && subjectLevels.some(sl => classLevels.includes(sl as any));
      });
      
      return matchesLevel && matchingSubjects.length > 0;
    });
  };

  const filteredClasses = getFilteredClasses();
  const sortedClasses = [...filteredClasses].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  const handleSlotClick = (day: string, period: string) => {
    // Check if this is a fixed period (lunch, prep, etc.)
    const isFixedPeriod = currentSchedule[day]?.[period]?.classId === 'fixed-period';
    if (isFixedPeriod) return;
    
    setSelectedDay(day);
    setSelectedPeriod(period);
    setIsSlotModalOpen(true);
  };

  const handleSaveSlot = (subjectId: string, classId: string, teacherId?: string) => {
    if (!selectedDay || !selectedPeriod) return;
    
    // Check for conflicts
    let hasConflict = false;
    let conflictMessage = '';
    
    if (mode === 'teacher' && classId) {
      const result = checkSlotConflict(
        'teacher',
        selectedDay,
        selectedPeriod,
        classId,
        selectedTeacherId,
        schedules,
        teachers,
        classes
      );
      
      hasConflict = result.hasConflict;
      conflictMessage = result.message;
    } else if (mode === 'class' && teacherId) {
      const result = checkSlotConflict(
        'class',
        selectedDay,
        selectedPeriod,
        teacherId,
        selectedClassId,
        schedules,
        teachers,
        classes
      );
      
      hasConflict = result.hasConflict;
      conflictMessage = result.message;
    }
    
    if (hasConflict) {
      showError('Çakışma Tespit Edildi', conflictMessage);
      return;
    }
    
    // Update schedule
    const updatedSchedule = { ...currentSchedule };
    
    if (!updatedSchedule[selectedDay]) {
      updatedSchedule[selectedDay] = {};
    }
    
    if (mode === 'teacher' && classId) {
      updatedSchedule[selectedDay][selectedPeriod] = classId ? {
        classId,
        subjectId
      } : null;
    } else if (mode === 'class' && teacherId) {
      updatedSchedule[selectedDay][selectedPeriod] = teacherId ? {
        teacherId,
        subjectId,
        classId: selectedClassId
      } : null;
    }
    
    setCurrentSchedule(updatedSchedule);
    setIsSlotModalOpen(false);
  };

  const handleSaveSchedule = async () => {
    // Validate schedule
    const validationResult = validateScheduleWithConstraints(
      mode,
      currentSchedule,
      mode === 'teacher' ? selectedTeacherId : selectedClassId,
      schedules,
      teachers,
      classes,
      subjects
    );
    
    if (!validationResult.isValid) {
      showError('Program Kaydedilemedi', `Aşağıdaki sorunları düzeltin:\n\n${validationResult.errors.join('\n')}`);
      return;
    }
    
    if (validationResult.warnings.length > 0) {
      const warningMessage = `Aşağıdaki uyarılar mevcut:\n\n${validationResult.warnings.join('\n')}\n\nYine de kaydetmek istiyor musunuz?`;
      
      showConfirmation({
        title: 'Uyarılar Mevcut',
        message: warningMessage,
        type: 'warning',
        confirmText: 'Yine de Kaydet',
        cancelText: 'İptal',
        confirmVariant: 'primary'
      }, handleConfirmSave);
      
      return;
    }
    
    await handleConfirmSave();
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    
    try {
      if (mode === 'teacher') {
        const existingSchedule = schedules.find(s => s.teacherId === selectedTeacherId);
        
        if (existingSchedule) {
          await updateSchedule(existingSchedule.id, {
            schedule: currentSchedule,
            updatedAt: new Date()
          });
        } else {
          await addSchedule({
            teacherId: selectedTeacherId,
            schedule: currentSchedule,
            updatedAt: new Date()
          } as Omit<Schedule, 'id' | 'createdAt'>);
        }
        
        const teacher = teachers.find(t => t.id === selectedTeacherId);
        success('✅ Program Kaydedildi', `${teacher?.name || 'Öğretmen'} programı başarıyla kaydedildi`);
      } else {
        // For class mode, we need to update multiple teacher schedules
        const teacherUpdates: { [teacherId: string]: { [day: string]: { [period: string]: any } } } = {};
        
        // Collect all updates
        DAYS.forEach(day => {
          PERIODS.forEach(period => {
            const slot = currentSchedule[day]?.[period];
            if (slot?.teacherId) {
              if (!teacherUpdates[slot.teacherId]) {
                teacherUpdates[slot.teacherId] = {};
              }
              
              if (!teacherUpdates[slot.teacherId][day]) {
                teacherUpdates[slot.teacherId][day] = {};
              }
              
              teacherUpdates[slot.teacherId][day][period] = {
                classId: selectedClassId,
                subjectId: slot.subjectId
              };
            }
          });
        });
        
        // Apply updates to teacher schedules
        for (const teacherId of Object.keys(teacherUpdates)) {
          const existingSchedule = schedules.find(s => s.teacherId === teacherId);
          
          if (existingSchedule) {
            const updatedSchedule = { ...existingSchedule.schedule };
            
            // Apply updates
            Object.entries(teacherUpdates[teacherId]).forEach(([day, periods]) => {
              if (!updatedSchedule[day]) {
                updatedSchedule[day] = {};
              }
              
              Object.entries(periods).forEach(([period, slot]) => {
                updatedSchedule[day][period] = slot;
              });
            });
            
            await updateSchedule(existingSchedule.id, {
              schedule: updatedSchedule,
              updatedAt: new Date()
            });
          } else {
            // Create new schedule for teacher
            const newSchedule: Schedule['schedule'] = {};
            
            DAYS.forEach(day => {
              newSchedule[day] = {};
            });
            
            // Apply updates
            Object.entries(teacherUpdates[teacherId]).forEach(([day, periods]) => {
              Object.entries(periods).forEach(([period, slot]) => {
                newSchedule[day][period] = slot;
              });
            });
            
            await addSchedule({
              teacherId,
              schedule: newSchedule,
              updatedAt: new Date()
            } as Omit<Schedule, 'id' | 'createdAt'>);
          }
        }
        
        const classItem = classes.find(c => c.id === selectedClassId);
        success('✅ Program Kaydedildi', `${classItem?.name || 'Sınıf'} programı başarıyla kaydedildi`);
      }
      
      // Update original schedule to match current
      setOriginalSchedule(JSON.parse(JSON.stringify(currentSchedule)));
      setHasUnsavedChanges(false);
    } catch (err) {
      error('❌ Kayıt Hatası', 'Program kaydedilirken bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (hasUnsavedChanges) {
      showConfirmation({
        title: 'Değişiklikleri Sıfırla',
        message: 'Kaydedilmemiş değişiklikler var. Sıfırlamak istediğinizden emin misiniz?',
        type: 'warning',
        confirmText: 'Sıfırla',
        cancelText: 'İptal',
        confirmVariant: 'danger'
      }, confirmReset);
    } else {
      confirmReset();
    }
  };

  const confirmReset = () => {
    setIsResetting(true);
    setCurrentSchedule(JSON.parse(JSON.stringify(originalSchedule)));
    setHasUnsavedChanges(false);
    setIsResetting(false);
    success('🔄 Program Sıfırlandı', 'Tüm değişiklikler sıfırlandı');
  };

  const handleModeChange = (newMode: 'teacher' | 'class') => {
    if (hasUnsavedChanges) {
      showConfirmation({
        title: 'Kaydedilmemiş Değişiklikler',
        message: 'Kaydedilmemiş değişiklikler var. Devam etmek istediğinizden emin misiniz?',
        type: 'warning',
        confirmText: 'Devam Et',
        cancelText: 'İptal',
        confirmVariant: 'danger'
      }, () => confirmModeChange(newMode));
    } else {
      confirmModeChange(newMode);
    }
  };

  const confirmModeChange = (newMode: 'teacher' | 'class') => {
    setMode(newMode);
    setSelectedTeacherId('');
    setSelectedClassId('');
    setCurrentSchedule({});
    setOriginalSchedule({});
    setHasUnsavedChanges(false);
    setSelectedLevel('');
    setSelectedBranch('');
    setShowScheduleTable(false);
  };

  const getSlotInfo = (day: string, period: string) => {
    const slot = currentSchedule[day]?.[period];
    
    if (mode === 'teacher') {
      if (!slot?.classId || slot.classId === 'fixed-period') return null;
      
      const classItem = classes.find(c => c.id === slot.classId);
      
      return { classItem };
    } else {
      if (!slot?.teacherId) return null;
      
      const teacher = teachers.find(t => t.id === slot.teacherId);
      
      return { teacher };
    }
  };

  // Check if a period is fixed (preparation, lunch, or afternoon breakfast)
  const isFixedPeriod = (day: string, period: string): boolean => {
    const slot = currentSchedule[day]?.[period];
    return slot?.classId === 'fixed-period';
  };

  // Get fixed period display info with correct text
  const getFixedPeriodInfo = (day: string, period: string, level?: 'Anaokulu' | 'İlkokul' | 'Ortaokul') => {
    const slot = currentSchedule[day]?.[period];
    if (!slot || slot.classId !== 'fixed-period') return null;

    if (slot.subjectId === 'fixed-prep') {
      return {
        title: 'Hazırlık',
        subtitle: level === 'Ortaokul' ? '08:30-08:40' : '08:30-08:50',
        color: 'bg-blue-100 border-blue-300 text-blue-800'
      };
    } else if (slot.subjectId === 'fixed-breakfast') {
      return {
        title: 'Kahvaltı',
        subtitle: '09:15-09:35',
        color: 'bg-orange-100 border-orange-300 text-orange-800'
      };
    } else if (slot.subjectId === 'fixed-lunch') {
      return {
        title: 'Yemek',
        subtitle: level === 'İlkokul' || level === 'Anaokulu' ? '11:50-12:25' : '12:30-13:05',
        color: 'bg-green-100 border-green-300 text-green-800'
      };
    } else if (slot.subjectId === 'fixed-afternoon-breakfast') {
      return {
        title: 'İkindi Kahvaltısı',
        subtitle: '14:35-14:45',
        color: 'bg-yellow-100 border-yellow-300 text-yellow-800'
      };
    }

    return null;
  };

  // Get time info for a period
  const getTimeInfo = (period: string) => {
    const currentLevel = mode === 'teacher' ? selectedLevel as any : selectedClass?.level;
    const timePeriod = getTimeForPeriod(period, currentLevel);
    if (timePeriod) {
      return formatTimeRange(timePeriod.startTime, timePeriod.endTime);
    }
    return `${period}. Ders`;
  };

  // Get teacher options
  const teacherOptions = teachers.map(teacher => ({
    value: teacher.id,
    label: `${teacher.name} (${teacher.branch} - ${teacher.level})`
  }));

  // Get class options
  const classOptions = sortedClasses.map(classItem => ({
    value: classItem.id,
    label: `${classItem.name} (${classItem.level})`
  }));

  return (
    <div className="container-mobile">
      {/* FIXED: Mobile-optimized header with consistent spacing */}
      <div className="header-mobile">
        <div className="flex items-center">
          <Calendar className="w-8 h-8 text-purple-600 mr-3" />
          <div>
            <h1 className="text-responsive-xl font-bold text-gray-900">Program Oluşturucu</h1>
            <p className="text-responsive-sm text-gray-600">
              {mode === 'teacher' ? 'Öğretmen bazlı program oluşturun' : 'Sınıf bazlı program oluşturun'}
            </p>
          </div>
        </div>
        <div className="button-group-mobile">
          <Button
            onClick={() => handleModeChange('teacher')}
            variant={mode === 'teacher' ? 'primary' : 'secondary'}
            icon={Users}
            className="w-full sm:w-auto"
          >
            Öğretmen Modu
          </Button>
          <Button
            onClick={() => handleModeChange('class')}
            variant={mode === 'class' ? 'primary' : 'secondary'}
            icon={Building}
            className="w-full sm:w-auto"
          >
            Sınıf Modu
          </Button>
        </div>
      </div>

      {/* Entity Selection */}
      <div className="mobile-card mobile-spacing mb-6">
        {mode === 'teacher' ? (
          <div className="space-y-4">
            <Select
              label="Öğretmen Seçin"
              value={selectedTeacherId}
              onChange={(value) => {
                if (hasUnsavedChanges) {
                  confirmUnsavedChanges(() => {
                    setSelectedTeacherId(value);
                    setSelectedLevel('');
                    setSelectedBranch('');
                    setShowScheduleTable(false);
                  });
                } else {
                  setSelectedTeacherId(value);
                  setSelectedLevel('');
                  setSelectedBranch('');
                  setShowScheduleTable(false);
                }
              }}
              options={teacherOptions}
              required
            />
            
            {selectedTeacher && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center mb-2">
                  <Users className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="font-medium text-blue-800">Öğretmen Bilgileri</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Ad Soyad:</span> {selectedTeacher.name}
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Branş:</span> {getTeacherBranches(selectedTeacher).join(', ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Seviye:</span> {getTeacherLevels(selectedTeacher).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {selectedTeacher && (
              <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center mb-2">
                  <Filter className="w-5 h-5 text-purple-600 mr-2" />
                  <h3 className="font-medium text-purple-800">Program Filtresi</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Eğitim Seviyesi Seçin"
                    value={selectedLevel}
                    onChange={setSelectedLevel}
                    options={levelOptions}
                    required
                  />
                  
                  <Select
                    label="Branş Seçin"
                    value={selectedBranch}
                    onChange={setSelectedBranch}
                    options={branchOptions}
                    required
                  />
                </div>
                
                {!showScheduleTable && selectedLevel && selectedBranch && (
                  <div className="flex justify-center">
                    <Button
                      onClick={() => setShowScheduleTable(true)}
                      variant="primary"
                      icon={Calendar}
                    >
                      Program Tablosunu Göster
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <Select
            label="Sınıf Seçin"
            value={selectedClassId}
            onChange={(value) => {
              if (hasUnsavedChanges) {
                confirmUnsavedChanges(() => {
                  setSelectedClassId(value);
                });
              } else {
                setSelectedClassId(value);
              }
            }}
            options={classOptions}
            required
          />
        )}
      </div>

      {/* Schedule Table */}
      {((mode === 'teacher' && showScheduleTable) || (mode === 'class' && selectedClassId)) && (
        <div className="mobile-card overflow-hidden mb-6">
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
              <div>
                <h3 className="font-medium text-gray-900">
                  {mode === 'teacher' 
                    ? `${selectedTeacher?.name || 'Öğretmen'} - ${selectedLevel} - ${selectedBranch} Programı` 
                    : `${selectedClass?.name || 'Sınıf'} Programı`}
                </h3>
                <p className="text-sm text-gray-600">
                  {mode === 'teacher' 
                    ? `${selectedLevel} seviyesindeki ${selectedBranch} dersleri için program` 
                    : `${selectedClass?.level || ''} seviyesi`}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleReset}
                  icon={RotateCcw}
                  variant="secondary"
                  disabled={!hasUnsavedChanges || isResetting}
                >
                  {isResetting ? 'Sıfırlanıyor...' : 'Sıfırla'}
                </Button>
                <Button
                  onClick={handleSaveSchedule}
                  icon={Save}
                  variant="primary"
                  disabled={!hasUnsavedChanges || isSaving}
                >
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </div>
            </div>
          </div>
          
          {hasUnsavedChanges && (
            <div className="p-3 bg-yellow-50 border-b border-yellow-200">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                <p className="text-sm text-yellow-700">
                  Kaydedilmemiş değişiklikler var
                </p>
              </div>
            </div>
          )}
          
          <div className="table-responsive">
            <table className="min-w-full schedule-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Saat
                  </th>
                  {DAYS.map(day => (
                    <th key={day} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Preparation Period */}
                <tr className="bg-blue-50">
                  <td className="px-3 py-2 font-medium text-gray-900 bg-blue-100 text-sm">
                    <div className="flex flex-col items-center">
                      <span>Hazırlık</span>
                      <span className="text-xs text-gray-600 flex items-center mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {mode === 'teacher' && selectedLevel === 'Ortaokul' ? '08:30-08:40' : '08:30-08:50'}
                      </span>
                    </div>
                  </td>
                  {DAYS.map(day => {
                    const fixedInfo = getFixedPeriodInfo(day, 'prep', mode === 'teacher' ? selectedLevel as any : selectedClass?.level);
                    
                    return (
                      <td key={`${day}-prep`} className="px-2 py-2">
                        <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                          <div className="font-medium text-blue-900 text-sm">
                            {fixedInfo?.title || 'Hazırlık'}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {PERIODS.map(period => {
                  const isLunchPeriod = (
                    ((mode === 'teacher' ? selectedLevel : selectedClass?.level) === 'İlkokul' || 
                     (mode === 'teacher' ? selectedLevel : selectedClass?.level) === 'Anaokulu') && period === '5'
                  ) || (
                    (mode === 'teacher' ? selectedLevel : selectedClass?.level) === 'Ortaokul' && period === '6'
                  );
                  
                  // Show breakfast between 1st and 2nd period for middle school
                  const showBreakfastAfter = (mode === 'teacher' ? selectedLevel : selectedClass?.level) === 'Ortaokul' && period === '1';
                  
                  const showAfternoonBreakAfter = period === '8';
                  
                  // Get time info for this period
                  const timeInfo = getTimeInfo(period);
                  
                  return (
                    <React.Fragment key={period}>
                      <tr className={isLunchPeriod ? 'bg-green-50' : ''}>
                        <td className={`px-3 py-2 font-medium text-gray-900 text-sm ${isLunchPeriod ? 'bg-green-100' : 'bg-gray-50'}`}>
                          <div className="flex flex-col items-center">
                            <span>{isLunchPeriod ? 'Yemek' : `${period}.`}</span>
                            <span className="text-xs text-gray-600 flex items-center mt-1">
                              <Clock className="w-3 h-3 mr-1" />
                              {isLunchPeriod 
                                ? ((mode === 'teacher' ? selectedLevel : selectedClass?.level) === 'İlkokul' || 
                                   (mode === 'teacher' ? selectedLevel : selectedClass?.level) === 'Anaokulu' 
                                     ? '11:50-12:25' 
                                     : '12:30-13:05')
                                : timeInfo}
                            </span>
                          </div>
                        </td>
                        {DAYS.map(day => {
                          if (isLunchPeriod) {
                            const fixedInfo = getFixedPeriodInfo(day, period, mode === 'teacher' ? selectedLevel as any : selectedClass?.level);
                            
                            return (
                              <td key={`${day}-${period}`} className="px-2 py-2">
                                <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                                  <div className="font-medium text-green-900 text-sm">
                                    Yemek
                                  </div>
                                </div>
                              </td>
                            );
                          }
                          
                          const slotInfo = getSlotInfo(day, period);
                          
                          return (
                            <td 
                              key={`${day}-${period}`} 
                              className="px-2 py-2"
                              onClick={() => handleSlotClick(day, period)}
                            >
                              {slotInfo ? (
                                <div className="text-center p-2 bg-blue-50 rounded border border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors">
                                  <div className="font-medium text-blue-900 text-sm">
                                    {mode === 'teacher' 
                                      ? slotInfo.classItem?.name 
                                      : slotInfo.teacher?.name}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors">
                                  <div className="text-gray-400 text-xs">Boş</div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Breakfast between 1st and 2nd period for middle school */}
                      {showBreakfastAfter && (
                        <tr className="bg-yellow-50">
                          <td className="px-3 py-2 font-medium text-gray-900 bg-yellow-100 text-sm">
                            <div className="flex flex-col items-center">
                              <span>Kahvaltı</span>
                              <span className="text-xs text-gray-600 flex items-center mt-1">
                                <Clock className="w-3 h-3 mr-1" />
                                09:15-09:35
                              </span>
                            </div>
                          </td>
                          {DAYS.map(day => {
                            const fixedInfo = getFixedPeriodInfo(day, 'breakfast', mode === 'teacher' ? selectedLevel as any : selectedClass?.level);
                            
                            return (
                              <td key={`${day}-breakfast`} className="px-2 py-2">
                                <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
                                  <div className="font-medium text-yellow-900 text-sm">
                                    {fixedInfo?.title || 'Kahvaltı'}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* İkindi Kahvaltısı 8. ders sonrasında */}
                      {showAfternoonBreakAfter && (
                        <tr className="bg-yellow-50">
                          <td className="px-3 py-2 font-medium text-gray-900 bg-yellow-100 text-sm">
                            <div className="flex flex-col items-center">
                              <span>İkindi Kahvaltısı</span>
                              <span className="text-xs text-gray-600 flex items-center mt-1">
                                <Clock className="w-3 h-3 mr-1" />
                                14:35-14:45
                              </span>
                            </div>
                          </td>
                          {DAYS.map(day => (
                            <td key={`${day}-afternoon-breakfast`} className="px-2 py-2">
                              <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
                                <div className="font-medium text-yellow-900 text-sm">
                                  İkindi Kahvaltısı
                                </div>
                              </div>
                            </td>
                          ))}
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {mode === 'teacher' && selectedTeacherId && !showScheduleTable && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Eğitim Seviyesi ve Branş Seçin</h3>
          <p className="text-gray-500 mb-4">
            Program tablosunu görmek için yukarıdan eğitim seviyesi ve branş seçin
          </p>
        </div>
      )}

      {/* No Selection State */}
      {((mode === 'teacher' && !selectedTeacherId) || (mode === 'class' && !selectedClassId)) && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {mode === 'teacher' ? 'Öğretmen Seçin' : 'Sınıf Seçin'}
          </h3>
          <p className="text-gray-500 mb-4">
            {mode === 'teacher' 
              ? 'Program oluşturmak için bir öğretmen seçin' 
              : 'Program oluşturmak için bir sınıf seçin'}
          </p>
        </div>
      )}

      {/* Schedule Slot Modal */}
      <ScheduleSlotModal
        isOpen={isSlotModalOpen}
        onClose={() => setIsSlotModalOpen(false)}
        onSave={handleSaveSlot}
        subjects={subjects.filter(s => {
          if (mode === 'teacher' && selectedLevel && selectedBranch) {
            // Filter subjects by selected level and branch
            const subjectLevels = s.levels || [s.level];
            return s.branch === selectedBranch && subjectLevels.includes(selectedLevel as any);
          }
          return true;
        })}
        classes={sortedClasses}
        teachers={teachers}
        mode={mode}
        currentSubjectId={currentSchedule[selectedDay]?.[selectedPeriod]?.subjectId || ''}
        currentClassId={
          mode === 'teacher' 
            ? currentSchedule[selectedDay]?.[selectedPeriod]?.classId || '' 
            : selectedClassId
        }
        currentTeacherId={
          mode === 'class' 
            ? currentSchedule[selectedDay]?.[selectedPeriod]?.teacherId || '' 
            : selectedTeacherId
        }
        day={selectedDay}
        period={selectedPeriod}
      />

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

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={hideError}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
};

export default Schedules;