
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
    
    // Saltar headers y líneas irrelevantes
    if (isHeaderLine(line) || isIrrelevantLine(line)) {
      continue;
    }
    
    // Buscar líneas con código de materia (ej: "R MLING2232019", "E MLHUM2229298")
    const codeMatch = line.match(/^(?:Select\s+\w+:\s+[^	]+\s+)?([RE])\s+([A-Z]{2,}[\d]+)\s+(.+)/);
    
    if (codeMatch) {
      const classInfo = parseTabularLine(line);
      if (classInfo) {
        // Crear identificador único
        const uniqueKey = `${classInfo.code}-${classInfo.section}-${classInfo.schedule}`;
        
        if (!seenClasses.has(uniqueKey)) {
          seenClasses.add(uniqueKey);
          
          const parsedClasses = createClassesFromTabular(classInfo);
          classes.push(...parsedClasses);
        }
      }
    }
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
  // El formato puede venir separado por tabs o múltiples espacios
  // Intentamos extraer los campos del texto
  
  // Remover prefijo "Select MLING...: Title" si existe
  let cleanLine = line;
  const selectMatch = line.match(/^Select\s+\w+:\s+[^	]+\t(.+)/);
  if (selectMatch) {
    cleanLine = selectMatch[1];
  }
  
  // Buscar patrón: [R/E] CODE Title Section Schedule Credits Campus Building Location Instructor ...
  // El formato parece ser: R MLING2232019	Ética Profesional	1721	MoWe 7:00AM - 8:29AM	6.00	UPANA	...
  
  // Intentar dividir por tabs primero
  let parts = cleanLine.split('\t').map(p => p.trim()).filter(p => p);
  
  // Si no hay suficientes partes con tabs, intentar con espacios múltiples
  if (parts.length < 5) {
    // Buscar el patrón directamente
    const directMatch = cleanLine.match(/([RE])\s+(\w+)\s+(.+?)\s+(\d{3,4})\s+([A-Za-z]{2,}[A-Za-z\s]*\d{1,2}:\d{2}(?:AM|PM)\s*-\s*\d{1,2}:\d{2}(?:AM|PM)(?:\.\.\.)?)\s+(\d+\.\d+)\s+(\w+)\s+(.+?)\s+([A-Z][a-záéíóú]+(?:\s+[A-Z][a-záéíóú]+)*(?:\s+[a-z]+\s+[a-z]+)?(?:,\s*[A-Z][a-záéíóú]+(?:\s+[A-Z][a-záéíóú]+)*)*)/i);
    
    if (directMatch) {
      return {
        code: directMatch[2],
        title: directMatch[3],
        section: directMatch[4],
        schedule: directMatch[5],
        credits: directMatch[6],
        campus: directMatch[7],
        building: '*various*',
        location: 'Mixcoac',
        instructor: directMatch[9] || 'Por asignar',
        status: 'Available',
        availability: ''
      };
    }
    
    return null;
  }
  
  // Extraer tipo (R o E) y código del primer campo
  const firstPart = parts[0];
  const typeCodeMatch = firstPart.match(/([RE])\s+(\w+)/);
  
  if (!typeCodeMatch) {
    return null;
  }
  
  return {
    code: typeCodeMatch[2],
    title: parts[1] || '',
    section: parts[2] || '',
    schedule: parts[3] || '',
    credits: parts[4] || '',
    campus: parts[5] || '',
    building: parts[6] || '',
    location: parts[7] || '',
    instructor: parts[8] || 'Por asignar',
    status: parts[10] || '',
    availability: parts[11] || ''
  };
}

function createClassesFromTabular(info: TabularClassInfo): Class[] {
  const classes: Class[] = [];
  
  // Parsear el horario - puede tener múltiples días
  // Formato: "MoWe 7:00AM - 8:29AM" o "TuWeTh 10:00AM - 11:29AM" o con "..."
  const schedule = info.schedule.replace(/\.\.\./, '').trim();
  
  // Extraer días y horario
  const scheduleMatch = schedule.match(/^([A-Za-z]+)\s+(\d{1,2}:\d{2}(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}(?:AM|PM))/);
  
  if (!scheduleMatch) {
    return classes;
  }
  
  const daysString = scheduleMatch[1];
  const horaInicio = scheduleMatch[2];
  const horaFin = scheduleMatch[3];
  
  // Separar días individuales (MoWe -> [Mo, We], TuWeTh -> [Tu, We, Th])
  const dayPatterns = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const dias: string[] = [];
  
  let remainingDays = daysString;
  for (const day of dayPatterns) {
    if (remainingDays.includes(day)) {
      dias.push(convertDayToSpanish(day));
      remainingDays = remainingDays.replace(day, '');
    }
  }
  
  if (dias.length === 0) {
    return classes;
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
  
  // Crear el nombre de la materia con el código
  const materia = `${info.code} - ${info.title}`;
  
  classes.push({
    materia,
    grupo: info.section,
    crn: info.section,
    dias,
    horaInicio,
    horaFin,
    aula,
    profesor: instructor,
    modalidad: 'Presencial',
    selected: false
  });
  
  return classes;
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
