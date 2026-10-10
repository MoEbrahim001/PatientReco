import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { LoadingService } from './shared/interceptors/services/loading.service';
import { FaceLandmarkerService } from './patients/face-landmarker.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  title = 'PatientReco';

  loading$ = this.loadingService.loading$;

  constructor(
    private loadingService: LoadingService,
    private http: HttpClient,
    private faceLandmarkerService: FaceLandmarkerService
  ) {}

  ngOnInit(): void {
    // Run both warmups in the background as soon as the app opens.
    this.warmUpPython();
    void this.faceLandmarkerService.preload();
  }

  private warmUpPython(): void {

    const startedAt = performance.now();

    const headers = new HttpHeaders({
      'X-Skip-Loading': 'true'
    });

    console.log(
      '[PERF][ANGULAR] Python warmup START'
    );

    this.http.get<{
      status: string;
      pythonReady: boolean;
    }>(
      `${environment.apiUrl}/System/warmup`,
      { headers }
    ).subscribe({

      next: response => {

        const duration =
          performance.now() - startedAt;

        console.log(
          `[PERF][ANGULAR] Python warmup END = ` +
          `${duration.toFixed(0)} ms | ` +
          `ready=${response.pythonReady}`
        );
      },

      error: error => {

        const duration =
          performance.now() - startedAt;

        console.error(
          `[PERF][ANGULAR] Python warmup FAILED = ` +
          `${duration.toFixed(0)} ms`,
          error
        );
      }

    });
  }
}
