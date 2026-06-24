
import { useState } from 'react';
import { TextInput } from '../components/TextInput';
import { ClassSelector } from '../components/ClassSelector';
import { ScheduleViewer } from '../components/ScheduleViewer';
import { parseScheduleText } from '../utils/parser';
import { generateScheduleCombinations } from '../utils/scheduler';
import { Class, GroupedClasses, ScheduleCombination } from '../types/schedule';

type AppStep = 'input' | 'select' | 'view';

const Index = () => {
  const [step, setStep] = useState<AppStep>('input');
  const [groupedClasses, setGroupedClasses] = useState<GroupedClasses>({});
  const [selectedCrns, setSelectedCrns] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<ScheduleCombination[]>([]);

  const handleTextParsed = (text: string) => {
    const parsedClasses = parseScheduleText(text);
    
    // Agrupar por materia
    const grouped: GroupedClasses = {};
    parsedClasses.forEach(cls => {
      if (!grouped[cls.materia]) {
        grouped[cls.materia] = [];
      }
      grouped[cls.materia].push(cls);
    });
    
    setGroupedClasses(grouped);
    setSelectedCrns([]);
    setStep('select');
  };

  const handleSelectionChange = (crns: string[]) => {
    setSelectedCrns(crns);
  };

  const handleCompleteSchedule = (
    crn: string,
    update: { dias: string[]; horaInicio: string; horaFin: string }
  ) => {
    setGroupedClasses(prev => {
      const next: GroupedClasses = {};
      for (const [materia, classes] of Object.entries(prev)) {
        next[materia] = classes.map(cls =>
          cls.crn === crn
            ? { ...cls, ...update, incompleteSchedule: false }
            : cls
        );
      }
      return next;
    });
  };

  const handleGenerateSchedules = () => {
    // Obtener únicamente las secciones (CRN) seleccionadas
    const crnSet = new Set(selectedCrns);
    const selectedClasses = Object.values(groupedClasses)
      .flat()
      .filter(cls => crnSet.has(cls.crn));
    
    const combinations = generateScheduleCombinations(selectedClasses);
    setSchedules(combinations);
    setStep('view');
  };

  const handleBack = () => {
    if (step === 'view') {
      setStep('select');
    } else if (step === 'select') {
      setStep('input');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="container mx-auto py-8">
        {step === 'input' && (
          <TextInput onTextParsed={handleTextParsed} />
        )}
        
        {step === 'select' && (
          <ClassSelector
            groupedClasses={groupedClasses}
            onSelectionChange={handleSelectionChange}
            onGenerateSchedules={handleGenerateSchedules}
            onCompleteSchedule={handleCompleteSchedule}
            onBack={handleBack}
          />
        )}
        
        {step === 'view' && (
          <ScheduleViewer
            combinations={schedules}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
