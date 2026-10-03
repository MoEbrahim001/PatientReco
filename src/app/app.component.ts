import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { LoadingService } from './shared/interceptors/services/loading.service';

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
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.warmUpPython();
  }

  private warmUpPython(): void {

    const headers = new HttpHeaders({
      'X-Skip-Loading': 'true'
    });

    this.http.get(
      `${environment.apiUrl}/System/warmup`,
      { headers }
    ).subscribe({
      next: () => {
        console.log('Face recognition service warmed up');
      },
      error: () => {
        console.log('Warmup request failed');
      }
    });
  }
}