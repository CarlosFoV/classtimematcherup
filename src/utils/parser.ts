
import { Class } from '../types/schedule';

export function parseScheduleText(text: string): Class[] {
  // Detectar si es formato tabular (nuevo formato)
  if (isTabularFormat(text)) {
    return parseTabularFormat(text);
  }
  
  // Formato anterior
  return parseLegacyFormat(text);
}

function isTabularFormat(text: string): boolean {
  // Detectar si contiene patrones del nuevo formato tabular
  return text.includes('MLING') || 
         text.includes('MLHUM') || 
         text.includes('MLECE') ||
         text.includes('MLEXING') ||
         text.includes('MLESD') ||
         text.includes('MLIN') ||
         text.includes('UPANA') ||
         (text.includes('Code') && text.includes('Title') && text.includes('Schedule'));
}

function parseTabularFormat(text: string): Class[] {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const classes: Class[] = [];
  const seenClasses = new Set<string>(); // Para evitar duplicados

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (isHeaderLine(line) || isIrrelevantLine(line)) {
      continue;
    }

    const classInfo = parseTabularLine(line);
    if (!classInfo) {
      continue;
    }

    const uniqueKey = `${classInfo.code}-${classInfo.section}-${classInfo.schedule}`;
    if (seenClasses.has(uniqueKey)) {
      continue;
    }
    seenClasses.add(uniqueKey);

    classes.push(...createClassesFromTabular(classInfo));
  }

  return classes;
}

interface TabularClassInfo {
  code: string;
  title: string;
  section: string;
  schedule: string;
  credits: string;
  campus: string;
  building: string;
  location: string;
  instructor: string;
  status: string;
  availability: string;
}

function parseTabularLine(line: string): TabularClassInfo | null {
  // Dividir en celdas por tabs; si no hay tabs, usar 2+ espacios como separador
  let cells = line.split('\t').map(c => c.trim()).filter(Boolean);
  if (cells.length < 4) {
    cells = line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
  }

  // Localizar la celda "R CODE" / "E CODE" (columna Add+Code), sin importar si
  // hay una celda "Select ...:" antes. El código puede terminar en letra (ej. MLIN2133886L).
  const codeIdx = cells.findIndex(c => /^[RE]\s+[A-Z]{2,}\d[A-Z0-9]*$/.test(c));
  if (codeIdx === -1) {
    return null;
  }

  const code = cells[codeIdx].replace(/^[RE]\s+/, '');
  const get = (offset: number): string => cells[codeIdx + offset] ?? '';

  return {
    code,
    title: get(1),
    section: get(2),
    schedule: get(3),
    credits: get(4),
    campus: get(5),
    building: get(6),
    location: get(7),
    instructor: get(8) || 'Por asignar',
    status: get(10),
    availability: get(11),
  };
}

function splitDays(daysString: string): string[] {
  // Separar días individuales (MoWe -> [Mo, We], TuWeTh -> [Tu, We, Th])
  const dayPatterns = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const dias: string[] = [];
  let remaining = daysString;
  for (const day of dayPatterns) {
    if (remaining.includes(day)) {
      dias.push(convertDayToSpanish(day));
      remaining = remaining.replace(day, '');
    }
  }
  return dias;
}

// Extrae los bloques "Días Hora - Hora" de un texto de horario, agrupando los
// días que comparten el mismo rango horario. Ej:
//   "MoWeFr 10:00AM - 11:29AM"            -> [{dias:[Lun,Miérc,Vier], 10:00AM, 11:29AM}]
//   "MoWe 8:30AM - 9:59AM Fr 1:00PM-2:29PM" -> [{..8:30..}, {..1:00..}]
export function parseScheduleSegments(
  schedule: string
): { dias: string[]; horaInicio: string; horaFin: string }[] {
  const scheduleText = schedule.replace(/\.\.\./g, ' ');
  const segmentRegex = /([A-Za-z]+)\s+(\d{1,2}:\d{2}(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}(?:AM|PM))/g;

  const byTime = new Map<string, { horaInicio: string; horaFin: string; dias: string[] }>();
  for (const seg of scheduleText.matchAll(segmentRegex)) {
    const dias = splitDays(seg[1]);
    if (dias.length === 0) continue;
    const key = `${seg[2]}-${seg[3]}`;
    const entry = byTime.get(key) ?? { horaInicio: seg[2], horaFin: seg[3], dias: [] };
    for (const d of dias) {
      if (!entry.dias.includes(d)) entry.dias.push(d);
    }
    byTime.set(key, entry);
  }

  return [...byTime.values()];
}

function createClassesFromTabular(info: TabularClassInfo): Class[] {
  // El portal recorta los horarios largos con "..." (el resto de los días solo
  // se ven en el hover y NO se copian). Marcamos esas clases como incompletas.
  const incompleteSchedule = info.schedule.includes('...');

  // Tomar TODOS los bloques "Días Hora - Hora" presentes (no solo el primero).
  const segments = parseScheduleSegments(info.schedule);

  if (segments.length === 0) {
    return [];
  }

  // Limpiar nombre del instructor
  let instructor = info.instructor;
  if (instructor.includes('Pendiente de Asignar') || instructor.includes('Personal')) {
    instructor = 'Por asignar';
  }
  // Formatear nombre: "Apellido, Nombre" -> "Nombre Apellido"
  if (instructor.includes(',')) {
    const nameParts = instructor.split(',').map(p => p.trim());
    if (nameParts.length >= 2) {
      instructor = `${nameParts[1]} ${nameParts[0]}`;
    }
  }

  // Determinar el aula
  let aula = info.building;
  if (aula === '*various*' || !aula) {
    aula = 'Por asignar';
  } else if (aula.includes(':')) {
    // Formato: "Edificio Rodin : R 47" -> "R 47 de Rodin"
    const buildingParts = aula.split(':').map(p => p.trim());
    if (buildingParts.length >= 2) {
      const buildingName = buildingParts[0].replace('Edificio', '').trim();
      aula = `${buildingParts[1]} de ${buildingName}`;
    }
  }

  const materia = `${info.code} - ${info.title}`;

  return segments.map(t => ({
    materia,
    grupo: info.section,
    crn: info.section,
    dias: t.dias,
    horaInicio: t.horaInicio,
    horaFin: t.horaFin,
    aula,
    profesor: instructor,
    modalidad: 'Presencial',
    selected: false,
    incompleteSchedule,
  }));
}

function convertDayToSpanish(day: string): string {
  const dayMap: { [key: string]: string } = {
    'Mo': 'Lun',
    'Tu': 'Mar',
    'We': 'Miérc',
    'Th': 'Jue',
    'Fr': 'Vier',
    'Sa': 'Sáb',
    'Su': 'Dom'
  };
  return dayMap[day] || day;
}

function isHeaderLine(line: string): boolean {
  return (line.includes('Add') && line.includes('Code') && line.includes('Title')) ||
         line.includes('Showing') && line.includes('entries') ||
         line === 'Search' ||
         line.match(/^Previous\d+Next$/) !== null ||
         line === 'ALL';
}

function isIrrelevantLine(line: string): boolean {
  return line === 'Show' ||
         line.match(/^entries$/) !== null ||
         line.length < 5;
}

function parseLegacyFormat(text: string): Class[] {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const classes: Class[] = [];
  let currentMateria = '';
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Detectar título de materia - formatos múltiples
    if (line.match(/^[A-Z_]{3,}\s+[A-Z]{2,}\d+\s*-\s*.+/) || 
        line.match(/^[A-Z_]{3,}\s+[A-Z-]{2,}\s*-\s*.+/)) {
      currentMateria = line.replace(/^[A-Z_]{3,}\s+/, '').trim();
      i++;
      continue;
    }
    
    // Saltar líneas de headers de tabla
    if ((line.includes('Class') || line.includes('Clase')) && 
        (line.includes('Section') || line.includes('Sección')) && 
        (line.includes('Days & Times') || line.includes('Días y Horas'))) {
      i++;
      continue;
    }
    
    // Saltar líneas irrelevantes
    if (line.includes('Shopping Cart') || 
        line.includes('Carrito') ||
        line.includes('Your shopping cart') || 
        line.includes('Su carrito') ||
        line.includes('class section(s) found') || 
        line.includes('secciones de clase encontradas') ||
        line.includes('Open') && line.includes('Closed') ||
        line.includes('Abierta') && line.includes('Cerrada') ||
        line.includes('Collapsible section') ||
        line.includes('Sección Contraíble') ||
        line === 'Open' || line === 'Closed' ||
        line === 'Abierta' || line === 'Cerrada' ||
        line.includes('Show Open Classes Only') ||
        line.includes('Course Career') ||
        line.includes('Universidad Panamericana') ||
        line.includes('Mi Horario') ||
        line.includes('Búsqueda de Clases') ||
        line.includes('Rtdo Búsq Cls') ||
        line.includes('Se prevé que las sesiones') ||
        line.includes('Notas:') ||
        line.includes('Selección') ||
        line.includes('Presencial') ||
        line.includes('En línea') ||
        line.includes('Híbrida') ||
        line.match(/^\d+\/\d+$/) ||
        line.includes('Personal') ||
        line.includes('INGLES') ||
        line.includes('Icono Ir a Inicio')) {
      i++;
      continue;
    }
    
    // Detectar inicio de clase (número CRN)
    if (line.match(/^\d{4,5}$/)) {
      const crn = line;
      const classData = parseClassBlock(lines, i, currentMateria, crn);
      if (classData) {
        classes.push(...classData);
      }
      i = skipToNextClass(lines, i);
      continue;
    }
    
    i++;
  }
  
  return classes;
}

function parseClassBlock(lines: string[], startIndex: number, materia: string, crn: string): Class[] | null {
  let i = startIndex + 1;
  if (i >= lines.length) return null;
  
  const grupo = lines[i].trim();
  if (!grupo) return null;
  
  i++;
  
  const daysAndTimes: string[] = [];
  const rooms: string[] = [];
  const instructors: string[] = [];
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)\s+\d{1,2}:\d{2}(AM|PM)\s*-\s*\d{1,2}:\d{2}(AM|PM)$/)) {
      daysAndTimes.push(line);
      i++;
      
      if (i < lines.length && !lines[i].trim().match(/^\d/)) {
        rooms.push(lines[i].trim());
        i++;
      }
      
      if (i < lines.length && !lines[i].trim().match(/^\d/) && !lines[i].trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)/)) {
        const instructor = lines[i].trim();
        if (instructor && !instructor.includes('/') && !instructor.includes('Open') && !instructor.includes('Select')) {
          instructors.push(instructor);
        }
        i++;
      }
    } else if (line.match(/^\d/) || line === 'Open' || line === 'Closed' || line.includes('Select')) {
      break;
    } else {
      i++;
    }
  }
  
  if (daysAndTimes.length === 0) {
    return parseAlternativeFormat(lines, startIndex, materia, crn, grupo);
  }
  
  const classes: Class[] = [];
  
  for (let j = 0; j < daysAndTimes.length; j++) {
    const dayTime = daysAndTimes[j];
    const room = rooms[j] || rooms[0] || 'Por asignar';
    const instructor = instructors[j] || instructors[0] || 'Por asignar';
    
    const parsedSchedule = parseDayTime(dayTime);
    if (parsedSchedule) {
      classes.push({
        materia,
        grupo,
        crn,
        dias: parsedSchedule.dias,
        horaInicio: parsedSchedule.horaInicio,
        horaFin: parsedSchedule.horaFin,
        aula: room,
        profesor: instructor,
        modalidad: 'Presencial',
        selected: false
      });
    }
  }
  
  return classes.length > 0 ? classes : null;
}

function parseAlternativeFormat(lines: string[], startIndex: number, materia: string, crn: string, grupo: string): Class[] | null {
  let i = startIndex + 2;
  const schedules: Array<{days: string, time: string}> = [];
  const rooms: string[] = [];
  const instructors: string[] = [];
  
  while (i < lines.length && i < startIndex + 20) {
    const line = lines[i].trim();
    
    if (line.match(/^\d{4,5}$/) || 
        line.includes('Abierta') || 
        line.includes('Cerrada') ||
        line.includes('Selección') ||
        line.match(/^[A-Z_]{3,}\s+[A-Z-]{2,}/)) {
      break;
    }
    
    if (line.match(/^(Lun|Mar|Miérc|Jue|Vier|Sáb|Dom|V)\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/)) {
      schedules.push({days: line.split(' ')[0], time: line.substring(line.indexOf(' ') + 1)});
    }
    else if (line.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)\s+\d{1,2}:\d{2}(AM|PM)\s*-\s*\d{1,2}:\d{2}(AM|PM)$/)) {
      schedules.push({days: line.split(' ')[0], time: line.substring(line.indexOf(' ') + 1)});
    }
    else if (line.match(/^(Salón|Laboratorio|Aula|Sala|Lab)/)) {
      rooms.push(line);
    }
    else if (line === 'P/Asig') {
      rooms.push('Por asignar');
    }
    else if (line.length > 5 && 
             !line.match(/^\d/) && 
             !line.includes('/') && 
             !line.includes('Open') && 
             !line.includes('Select') &&
             !line.includes('Ordinario') &&
             !line.includes('DIS') &&
             !line.includes('LAB') &&
             !line.includes('LEC') &&
             !line.includes('Personal') &&
             !line.includes('INGLES') &&
             !line.match(/^\d+\/\d+$/) &&
             line.includes(' ') &&
             !line.match(/^(Salón|Laboratorio|Aula|Sala|Lab)/) &&
             line.charAt(0).toUpperCase() === line.charAt(0)) {
      instructors.push(line);
    }
    
    i++;
  }
  
  if (schedules.length === 0) {
    return null;
  }
  
  const classes: Class[] = [];
  
  schedules.forEach((schedule, index) => {
    const room = rooms[index] || rooms[0] || 'Por asignar';
    const instructor = instructors[index] || instructors[0] || 'Por asignar';
    
    let timeFormat = schedule.time;
    let dayFormat = schedule.days;
    
    if (!timeFormat.includes('AM') && !timeFormat.includes('PM')) {
      timeFormat = convertTo12HourFormat(timeFormat);
    }
    
    const dayMap: { [key: string]: string } = {
      'Lun': 'Lun',
      'Mar': 'Mar', 
      'Miérc': 'Miérc',
      'Jue': 'Jue',
      'Vier': 'Vier',
      'Sáb': 'Sáb',
      'Dom': 'Dom',
      'V': 'Vier',
      'Mo': 'Lun',
      'Tu': 'Mar',
      'We': 'Miérc',
      'Th': 'Jue',
      'Fr': 'Vier',
      'Sa': 'Sáb',
      'Su': 'Dom'
    };
    
    const convertedDay = dayMap[dayFormat] || dayFormat;
    
    const timeMatch = timeFormat.match(/(\d{1,2}:\d{2}(?:AM|PM)?)\s*-\s*(\d{1,2}:\d{2}(?:AM|PM)?)/);
    if (timeMatch) {
      let horaInicio = timeMatch[1];
      let horaFin = timeMatch[2];
      
      if (!horaInicio.includes('AM') && !horaInicio.includes('PM')) {
        horaInicio = convertTo12HourFormat(horaInicio + ' - ' + horaFin).split(' - ')[0];
        horaFin = convertTo12HourFormat(horaInicio + ' - ' + horaFin).split(' - ')[1];
      }
      
      classes.push({
        materia,
        grupo,
        crn,
        dias: [convertedDay],
        horaInicio,
        horaFin,
        aula: room,
        profesor: instructor,
        modalidad: 'Presencial',
        selected: false
      });
    }
  });
  
  return classes.length > 0 ? classes : null;
}

function convertTo12HourFormat(timeString: string): string {
  const match = timeString.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return timeString;
  
  const startHour = parseInt(match[1]);
  const startMin = match[2];
  const endHour = parseInt(match[3]);
  const endMin = match[4];
  
  const formatTime = (hour: number, min: string) => {
    if (hour === 0) return `12:${min}AM`;
    if (hour < 12) return `${hour}:${min}AM`;
    if (hour === 12) return `12:${min}PM`;
    return `${hour - 12}:${min}PM`;
  };
  
  return `${formatTime(startHour, startMin)} - ${formatTime(endHour, endMin)}`;
}

function parseDayTime(dayTime: string): {dias: string[], horaInicio: string, horaFin: string} | null {
  const match = dayTime.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)\s+(\d{1,2}:\d{2}(AM|PM))\s*-\s*(\d{1,2}:\d{2}(AM|PM))$/);
  
  if (!match) return null;
  
  const dayAbbrev = match[1];
  const horaInicio = match[2];
  const horaFin = match[4];
  
  const dayMap: { [key: string]: string } = {
    'Mo': 'Lun',
    'Tu': 'Mar',
    'We': 'Miérc',
    'Th': 'Jue',
    'Fr': 'Vier',
    'Sa': 'Sáb',
    'Su': 'Dom'
  };
  
  const dia = dayMap[dayAbbrev] || dayAbbrev;
  
  return {
    dias: [dia],
    horaInicio,
    horaFin
  };
}

function skipToNextClass(lines: string[], currentIndex: number): number {
  let i = currentIndex + 1;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.match(/^\d{4,5}$/)) {
      return i;
    }
    
    if (line.match(/^[A-Z_]{3,}\s+[A-Z]{2,}\d+\s*-\s*.+/) || 
        line.match(/^[A-Z_]{3,}\s+[A-Z-]{2,}\s*-\s*.+/)) {
      return i;
    }
    
    i++;
  }
  
  return i;
}

export function timeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3];
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${displayHours}:${mins.toString().padStart(2, '0')}${period}`;
}
