import { Component } from '@angular/core';
import{LoadingService}from'./shared/interceptors/services/loading.service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  title = 'PatientReco';

  loading$ = this.loadingService.loading$;

  constructor(
    private loadingService: LoadingService
  ) {}
}