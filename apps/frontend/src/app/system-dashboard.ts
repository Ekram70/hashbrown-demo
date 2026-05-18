import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Endpoint {
  path: string;
  method: string;
  latency: string;
}

@Component({
  selector: 'app-system-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="widget-card dashboard-widget-card">
      <div class="widget-header">
        <div class="widget-badge">📊 BACKEND HEALTH REPORT</div>
        <div class="dashboard-header-row">
          <h3 class="widget-title">Express Status</h3>
          <span class="badge-status-pulse">
            <span class="status-pulse-dot"></span>
            {{ serverStatus() }}
          </span>
        </div>
      </div>

      <div class="widget-body">
        <!-- Metrics Grid -->
        <div class="metrics-row">
          <div class="metric-box">
            <span class="metric-label">UPTIME</span>
            <span class="metric-value">{{ uptime() }}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">ACTIVE CLIENTS</span>
            <span class="metric-value">{{ activeConnections() }}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">MEM FOOTPRINT</span>
            <span class="metric-value">{{ memoryUsage() }}</span>
          </div>
        </div>

        <!-- CPU Progress Meter -->
        <div class="progress-meter-container">
          <div class="meter-labels">
            <span class="meter-name">CPU Allocation</span>
            <span class="meter-val">{{ cpuUsage() }}%</span>
          </div>
          <div class="meter-track">
            <div class="meter-fill" [style.width.%]="cpuUsage()"></div>
          </div>
        </div>

        <!-- Endpoint Latencies -->
        <div class="endpoints-section">
          <h4 class="body-subtitle">Monitored Service Latencies</h4>
          <div class="endpoints-list">
            @for (endpoint of endpoints(); track endpoint.path) {
              <div class="endpoint-item">
                <div class="endpoint-meta">
                  <span class="method-badge" [class.badge-post]="endpoint.method === 'POST'">
                    {{ endpoint.method }}
                  </span>
                  <code class="endpoint-path">{{ endpoint.path }}</code>
                </div>
                <span class="latency-label">{{ endpoint.latency }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class SystemDashboardComponent {
  serverStatus = input<string>('UNKNOWN');
  cpuUsage = input<number>(0);
  memoryUsage = input<string>('0MB');
  uptime = input<string>('0s');
  activeConnections = input<number>(0);
  endpoints = input<Endpoint[]>([]);
}
