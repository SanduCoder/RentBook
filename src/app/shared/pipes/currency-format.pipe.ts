import { Pipe, PipeTransform } from '@angular/core';
import { formatCurrency } from '../../core/utils/firestore.utils';

@Pipe({ name: 'currencyFormat', standalone: true })
export class CurrencyFormatPipe implements PipeTransform {
  transform(amount: number | null | undefined, currency = 'GMD'): string {
    if (amount == null) return '—';
    return formatCurrency(amount, currency);
  }
}
