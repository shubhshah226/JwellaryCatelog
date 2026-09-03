import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import type { ECharts, EChartsOption } from 'echarts';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  PieChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

@Component({
  selector: 'app-echart',
  template: `<div #chartHost class="echart-host"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .echart-host {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class EchartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartHost', { static: true }) chartHost!: ElementRef<HTMLDivElement>;

  @Input() options: EChartsOption | null = null;
  @Input() theme: 'dark' | 'light' = 'dark';

  private readonly platformId = inject(PLATFORM_ID);
  private chart?: ECharts;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initChart();
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!isPlatformBrowser(this.platformId) || !this.chartHost) {
      return;
    }

    if (changes['theme'] && !changes['theme'].firstChange) {
      this.chart?.dispose();
      this.initChart();
    }

    this.render();
  }

  ngOnDestroy(): void {
    this.chart?.dispose();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.chart?.resize();
  }

  private initChart(): void {
    this.chart = echarts.init(
      this.chartHost.nativeElement,
      this.theme === 'dark' ? 'dark' : undefined
    );
  }

  private render(): void {
    if (!this.chart || !this.options) {
      return;
    }

    this.chart.setOption(this.options, { notMerge: true });
    this.chart.resize();
  }
}
