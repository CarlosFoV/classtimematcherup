export interface Class {
  materia: string;
  grupo: string;
  crn: string;
  dias: string[];
  horaInicio: string;
  horaFin: string;
  aula: string;
  profesor: string;
  modalidad: string;
  selected?: boolean;
  incompleteSchedule?: boolean;
}

export interface TimeSlot {
  day: string;
  startTime: number; // minutes from midnight
  endTime: number; // minutes from midnight
}

export interface ScheduleCombination {
  id: string;
  classes: Class[];
  conflicts: boolean;
}

export interface GroupedClasses {
  [materia: string]: Class[];
}