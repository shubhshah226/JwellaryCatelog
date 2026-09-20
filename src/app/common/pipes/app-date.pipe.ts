import { Pipe, PipeTransform } from '@angular/core';
import { formatGridDateTime } from '../utils/date-time.util';

/**
 * Formats API/grid datetimes as `dd/mm/yyyy hh:mm AM|PM` (India).
 * Usage: `{{ row.joinedOn | appDate }}`
 */
@Pipe({
  name: 'appDate',
  standalone: true,
})
export class AppDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return formatGridDateTime(value);
  }
}
