import { Directive, Input, TemplateRef } from '@angular/core';

/** Marks an ng-template for a custom data-grid cell: `<ng-template dataGridCell="contact" let-row>` */
@Directive({
  selector: 'ng-template[dataGridCell]',
  standalone: true,
})
export class DataGridCellDirective {
  @Input('dataGridCell') key = '';

  constructor(readonly template: TemplateRef<{ $implicit: unknown; row: unknown }>) {}
}
