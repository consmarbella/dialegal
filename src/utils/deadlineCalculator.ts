import { CHILEAN_HOLIDAYS_2025_2026 } from '../data/chileanLegalData';

export interface CalculationResult {
  startDate: string;
  targetDate: string;
  totalDaysAdded: number;
  holidaysSkipped: string[];
  sundaysSkipped: number;
  saturdaysSkipped?: number;
  daysRemaining: number;
  isExpired: boolean;
  typeExplanation: string;
}

export function isHoliday(dateStr: string): boolean {
  return CHILEAN_HOLIDAYS_2025_2026.includes(dateStr);
}

export function formatDateChile(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('es-CL', options);
}

/**
 * Calculates Chilean procedural deadline dates
 * @param startDateStr Notification date (YYYY-MM-DD)
 * @param daysNumber Number of days
 * @param type 'habiles_cpc' (Mon-Sat, excluding Sun & holidays), 'habiles_laboral' (Mon-Fri, excluding Sat, Sun & holidays), or 'corridos'
 */
export function calculateChileanDeadline(
  startDateStr: string,
  daysNumber: number,
  type: 'habiles_cpc' | 'habiles_laboral' | 'corridos'
): CalculationResult {
  const startDate = new Date(startDateStr + 'T00:00:00');
  let currentDate = new Date(startDate);
  
  // Plazo fatal comienza a correr al día siguiente de la notificación legal
  currentDate.setDate(currentDate.getDate() + 1);

  let countedDays = 0;
  const holidaysSkipped: string[] = [];
  let sundaysSkipped = 0;
  let saturdaysSkipped = 0;

  if (type === 'corridos') {
    // Days are calendar days (días corridos)
    for (let i = 0; i < daysNumber - 1; i++) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    // Business days (días hábiles)
    while (countedDays < daysNumber) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const formattedIso = currentDate.toISOString().split('T')[0];
      const isChileanHoliday = isHoliday(formattedIso);

      let isBusinessDay = false;

      if (type === 'habiles_cpc') {
        // CPC Art. 66: Días hábiles son de Lunes a Sábado, salvo domingos y festivos
        if (dayOfWeek === 0) {
          sundaysSkipped++;
        } else if (isChileanHoliday) {
          holidaysSkipped.push(formattedIso);
        } else {
          isBusinessDay = true;
        }
      } else if (type === 'habiles_laboral') {
        // Código del Trabajo / Ley 19.880: Días hábiles son de Lunes a Viernes
        if (dayOfWeek === 0) {
          sundaysSkipped++;
        } else if (dayOfWeek === 6) {
          saturdaysSkipped++;
        } else if (isChileanHoliday) {
          holidaysSkipped.push(formattedIso);
        } else {
          isBusinessDay = true;
        }
      }

      if (isBusinessDay) {
        countedDays++;
        if (countedDays === daysNumber) {
          break;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  const targetIso = currentDate.toISOString().split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = currentDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let typeExplanation = '';
  if (type === 'habiles_cpc') {
    typeExplanation = 'Días hábiles conforme al Art. 66 del Código de Procedimiento Civil (Lunes a Sábado, excluyendo domingos y festivos en Chile).';
  } else if (type === 'habiles_laboral') {
    typeExplanation = 'Días hábiles administrativos/laborales (Lunes a Viernes, excluyendo sábados, domingos y festivos en Chile).';
  } else {
    typeExplanation = 'Días corridos continuos (todos los días del calendario).';
  }

  return {
    startDate: startDateStr,
    targetDate: targetIso,
    totalDaysAdded: daysNumber,
    holidaysSkipped,
    sundaysSkipped,
    saturdaysSkipped,
    daysRemaining,
    isExpired: daysRemaining < 0,
    typeExplanation,
  };
}
