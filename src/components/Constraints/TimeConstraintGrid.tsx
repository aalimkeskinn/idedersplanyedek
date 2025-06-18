import React, { useState, useEffect } from 'react';
import { Clock, Save, RotateCcw, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { DAYS, PERIODS, getTimeForPeriod, formatTimeRange } from '../../types';
import { TimeConstraint, CONSTRAINT_TYPES, ConstraintType } from '../../types/constraints';
import Button from '../UI/Button';

interface TimeConstraintGridProps {
  entityType: 'teacher' | 'class' | 'subject';
  entityId: string;
  entityName: string;
  entityLevel?: 'Anaokulu' | 'İlkokul' | 'Ortaokul';
  constraints: TimeConstraint[];
  onConstraintsChange: (constraints: TimeConstraint[]) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
}

const TimeConstraintGrid: React.FC<TimeConstraintGridProps> = ({
  entityType,
  entityId,
  entityName,
  entityLevel,
  constraints,
  onConstraintsChange,
  onSave,
  hasUnsavedChanges
}) => {
  const [selectedConstraintType, setSelectedConstraintType] = useState<ConstraintType>('unavailable');
  const [isInitialized, setIsInitialized] = useState(false);

  // CRITICAL: Initialize all slots as "preferred" by default
  useEffect(() => {
    if (!isInitialized && entityId) {
      const existingConstraints = constraints.filter(c => c.entityId === entityId);
      
      // If no constraints exist for this entity, create default "preferred" constraints for all slots
      if (existingConstraints.length === 0) {
        const defaultConstraints: TimeConstraint[] = [];
        
        DAYS.forEach(day => {
          PERIODS.forEach(period => {
            const newConstraint: TimeConstraint = {
              id: `${entityId}-${day}-${period}-default`,
              entityType,
              entityId,
              day,
              period,
              constraintType: 'preferred',
              reason: `Default tercih edilen - ${entityName}`,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            defaultConstraints.push(newConstraint);
          });
        });
        
        // Add default constraints to the existing constraints
        const allConstraints = [...constraints, ...defaultConstraints];
        onConstraintsChange(allConstraints);
        
        console.log('✅ Default "tercih edilen" kısıtlamalar oluşturuldu:', {
          entityName,
          entityId,
          constraintCount: defaultConstraints.length
        });
      }
      
      setIsInitialized(true);
    }
  }, [entityId, entityName, entityType, constraints, onConstraintsChange, isInitialized]);

  const getConstraintForSlot = (day: string, period: string): TimeConstraint | undefined => {
    return constraints.find(c => 
      c.entityId === entityId && 
      c.day === day && 
      c.period === period
    );
  };

  const handleSlotClick = (day: string, period: string) => {
    console.log('🔄 Slot tıklandı:', {
      day,
      period,
      selectedConstraintType,
      entityId,
      entityName
    });

    const existingConstraint = getConstraintForSlot(day, period);
    
    if (existingConstraint) {
      if (existingConstraint.constraintType === selectedConstraintType) {
        // Same type clicked - change back to preferred
        const updatedConstraints = constraints.map(c => 
          (c.entityId === entityId && c.day === day && c.period === period)
            ? {
                ...c,
                constraintType: 'preferred' as ConstraintType,
                reason: `Tercih edilen - ${entityName}`,
                updatedAt: new Date()
              }
            : c
        );
        onConstraintsChange(updatedConstraints);
        console.log('✅ Kısıtlama "tercih edilen"e değiştirildi');
      } else {
        // Different type - change to selected type
        const updatedConstraints = constraints.map(c => 
          (c.entityId === entityId && c.day === day && c.period === period)
            ? {
                ...c,
                constraintType: selectedConstraintType,
                reason: `${CONSTRAINT_TYPES[selectedConstraintType].label} - ${entityName}`,
                updatedAt: new Date()
              }
            : c
        );
        onConstraintsChange(updatedConstraints);
        console.log('✅ Kısıtlama değiştirildi:', {
          from: existingConstraint.constraintType,
          to: selectedConstraintType
        });
      }
    } else {
      // No constraint exists - create new one
      const newConstraint: TimeConstraint = {
        id: `${entityId}-${day}-${period}-${Date.now()}`,
        entityType,
        entityId,
        day,
        period,
        constraintType: selectedConstraintType,
        reason: `${CONSTRAINT_TYPES[selectedConstraintType].label} - ${entityName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      onConstraintsChange([...constraints, newConstraint]);
      console.log('✅ Yeni kısıtlama oluşturuldu:', newConstraint);
    }
  };

  const resetToPreferred = () => {
    console.log('🔄 Tüm kısıtlamalar "tercih edilen"e sıfırlanıyor');
    
    const updatedConstraints = constraints.map(c => 
      c.entityId === entityId
        ? {
            ...c,
            constraintType: 'preferred' as ConstraintType,
            reason: `Tercih edilen - ${entityName}`,
            updatedAt: new Date()
          }
        : c
    );
    onConstraintsChange(updatedConstraints);
    console.log('✅ Tüm kısıtlamalar sıfırlandı');
  };

  const getTimeInfo = (period: string) => {
    const timePeriod = getTimeForPeriod(period, entityLevel);
    if (timePeriod) {
      return formatTimeRange(timePeriod.startTime, timePeriod.endTime);
    }
    return `${period}. Ders`;
  };

  const getConstraintCount = (type: ConstraintType) => {
    return constraints.filter(c => 
      c.entityId === entityId && c.constraintType === type
    ).length;
  };

  return (
    <div className="space-y-6">
      {/* PROFESSIONAL: Clean header */}
      <div className="p-6 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {entityName} - Zaman Kısıtlamaları
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              <span className="inline-flex items-center text-green-600 font-medium">
                <CheckCircle className="w-4 h-4 mr-1" />
                Varsayılan: Tüm saatler "Tercih Edilen"
              </span>
              <span className="mx-2">•</span>
              Zaman dilimlerine tıklayarak kısıtlama değiştirin
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {hasUnsavedChanges && (
              <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Kaydedilmedi
              </span>
            )}
            <Button
              onClick={resetToPreferred}
              icon={RotateCcw}
              variant="secondary"
              size="sm"
              title="Tüm saatleri 'Tercih Edilen' yap"
            >
              Sıfırla
            </Button>
            <Button
              onClick={onSave}
              icon={Save}
              variant="primary"
              size="sm"
              disabled={!hasUnsavedChanges}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </div>

      {/* PROFESSIONAL: Constraint type selector */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Distribution */}
          <div className="lg:col-span-1">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Mevcut Dağılım</h4>
            <div className="space-y-3">
              {Object.entries(CONSTRAINT_TYPES).map(([type, config]) => {
                const count = getConstraintCount(type as ConstraintType);
                return (
                  <div
                    key={type}
                    className={`p-3 rounded-lg border-2 ${config.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{config.icon}</span>
                        <span className="font-medium text-sm">{config.label}</span>
                      </div>
                      <span className="text-lg font-bold">{count}</span>
                    </div>
                    <p className="text-xs opacity-75 mt-1">{config.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FIXED: Constraint Type Selector */}
          <div className="lg:col-span-1">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Değiştirmek İçin Seçin</h4>
            <div className="space-y-2">
              <button
                onClick={() => {
                  console.log('🔄 Kısıtlama türü değiştirildi: unavailable');
                  setSelectedConstraintType('unavailable');
                }}
                className={`w-full p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                  selectedConstraintType === 'unavailable'
                    ? 'bg-red-100 border-red-300 text-red-800 ring-2 ring-red-500 ring-opacity-50'
                    : 'bg-white border-gray-200 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <XCircle className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Müsait Değil</div>
                    <div className="text-xs opacity-75">Program oluşturmayı engeller</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  console.log('🔄 Kısıtlama türü değiştirildi: restricted');
                  setSelectedConstraintType('restricted');
                }}
                className={`w-full p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                  selectedConstraintType === 'restricted'
                    ? 'bg-yellow-100 border-yellow-300 text-yellow-800 ring-2 ring-yellow-500 ring-opacity-50'
                    : 'bg-white border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Kısıtlı</div>
                    <div className="text-xs opacity-75">Uyarı verir ama engel olmaz</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  console.log('🔄 Kısıtlama türü değiştirildi: preferred');
                  setSelectedConstraintType('preferred');
                }}
                className={`w-full p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                  selectedConstraintType === 'preferred'
                    ? 'bg-green-100 border-green-300 text-green-800 ring-2 ring-green-500 ring-opacity-50'
                    : 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Tercih Edilen</div>
                    <div className="text-xs opacity-75">Normal program oluşturma</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="lg:col-span-1">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Nasıl Kullanılır</h4>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>1.</strong> Yukarıdan kısıtlama türü seçin</p>
                  <p><strong>2.</strong> Zaman tablosunda istediğiniz saate tıklayın</p>
                  <p><strong>3.</strong> Aynı türe tekrar tıklayarak "tercih edilen"e dönebilirsiniz</p>
                  <p><strong>4.</strong> Değişiklikleri kaydetmeyi unutmayın!</p>
                </div>
              </div>
            </div>

            {/* ADDED: Current Selection Info */}
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{CONSTRAINT_TYPES[selectedConstraintType].icon}</span>
                <div>
                  <div className="font-medium text-purple-800 text-sm">
                    Seçili: {CONSTRAINT_TYPES[selectedConstraintType].label}
                  </div>
                  <div className="text-xs text-purple-600">
                    {CONSTRAINT_TYPES[selectedConstraintType].description}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PROFESSIONAL: Time Grid */}
      <div className="border-t border-gray-200">
        <div className="table-responsive">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">
                  Ders Saati
                </th>
                {DAYS.map(day => (
                  <th key={day} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    <div className="font-bold">{day}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {constraints.filter(c => c.entityId === entityId && c.day === day && c.constraintType !== 'preferred').length} kısıtlı
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {PERIODS.map((period, index) => {
                const timeInfo = getTimeInfo(period);
                
                return (
                  <tr key={period} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50 sticky left-0 z-10 border-r border-gray-200">
                      <div className="text-center">
                        <div className="font-bold text-sm">{period}. Ders</div>
                        <div className="text-xs text-gray-600 mt-1 flex items-center justify-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {timeInfo}
                        </div>
                      </div>
                    </td>
                    {DAYS.map(day => {
                      const constraint = getConstraintForSlot(day, period);
                      const constraintConfig = constraint ? CONSTRAINT_TYPES[constraint.constraintType] : CONSTRAINT_TYPES.preferred;
                      
                      return (
                        <td key={`${day}-${period}`} className="px-2 py-2">
                          <button
                            onClick={() => handleSlotClick(day, period)}
                            className={`w-full min-h-[70px] p-3 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                              constraintConfig.color
                            } hover:opacity-80 hover:scale-105 hover:shadow-md`}
                            title={
                              constraint?.constraintType === 'preferred' 
                                ? `✅ Tercih edilen saat - Değiştirmek için tıklayın`
                                : `${constraintConfig.icon} ${constraintConfig.label} - Tercih edilene dönmek için tıklayın`
                            }
                          >
                            <div className="text-center">
                              <div className="text-xl mb-1">{constraintConfig.icon}</div>
                              <div className="text-xs font-medium leading-tight">
                                {constraintConfig.label}
                              </div>
                              {constraint?.constraintType !== 'preferred' && (
                                <div className="text-xs opacity-75 mt-1">
                                  Tıkla → Tercih edilen
                                </div>
                              )}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PROFESSIONAL: Summary */}
      <div className="p-6 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{getConstraintCount('preferred')}</div>
              <div className="text-xs text-gray-600">Tercih Edilen</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{getConstraintCount('unavailable')}</div>
              <div className="text-xs text-gray-600">Müsait Değil</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">{getConstraintCount('restricted')}</div>
              <div className="text-xs text-gray-600">Kısıtlı</div>
            </div>
          </div>
          
          {hasUnsavedChanges && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-yellow-600 font-medium">Değişiklikler kaydedilmedi</span>
              <Button
                onClick={onSave}
                icon={Save}
                variant="primary"
                size="sm"
              >
                Kaydet
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeConstraintGrid;