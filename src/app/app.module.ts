import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { AddPatientComponent } from './patients/add-patient/add-patient.component';
import { PatientsComponent } from './patients/patients.component';
import { EditPatientComponent } from './patients/edit-patient/edit-patient.component';

import { FaceRecognitionComponent } from './face-recognition/face-recognition.component';
import { PatientRegistrationComponent } from './patient-registration/patient-registration.component';

import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { CalendarModule } from 'primeng/calendar';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';

import {
  DynamicDialogModule,
  DynamicDialogConfig,
  DialogService
} from 'primeng/dynamicdialog';

import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import {
  HttpClientModule,
  HTTP_INTERCEPTORS
} from '@angular/common/http';

import { DatePipe } from '@angular/common';
import { ConfirmationService } from 'primeng/api';

import { LoadingInterceptor } from './shared/interceptors/loading.interceptor';


@NgModule({
  declarations: [
    AppComponent,
    AddPatientComponent,
    EditPatientComponent,
    PatientsComponent,
    FaceRecognitionComponent,
    PatientRegistrationComponent
  ],

  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,

    AutoCompleteModule,
    ButtonModule,
    MatDialogModule,
    MatButtonModule,
    CalendarModule,
    CheckboxModule,
    ConfirmDialogModule,
    DynamicDialogModule,
    DialogModule,
    InputTextModule,
    TooltipModule,
    TableModule
  ],

  providers: [
    DatePipe,
    DialogService,
    ConfirmationService,
    DynamicDialogConfig,

    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true
    }
  ],

  bootstrap: [
    AppComponent
  ]
})
export class AppModule { }