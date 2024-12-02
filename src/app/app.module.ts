import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AddPatientComponent } from './patients/add-patient/add-patient.component';
import { PatientsComponent } from './patients/patients.component';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { HttpClientModule } from '@angular/common/http';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog'; // Import DialogModule
import { DynamicDialogModule, DynamicDialogConfig, DialogService } from 'primeng/dynamicdialog';
import { EditPatientComponent } from './patients/edit-patient/edit-patient.component';
// import { ConfirmDeleteDialogComponent } from './patients/confirm-delete-dialog/confirm-delete-dialog.component';
import { FaceRecognitionComponent } from './face-recognition/face-recognition.component';
import { PatientRegistrationComponent } from './patient-registration/patient-registration.component';
import { DatePipe } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';




@NgModule({
  declarations: [
    AppComponent,
    AddPatientComponent,
    EditPatientComponent,
    // ConfirmDeleteDialogComponent,
    PatientsComponent,
    FaceRecognitionComponent,
    PatientRegistrationComponent,
    
    
  ],
  imports: [
  
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    AutoCompleteModule,
    ButtonModule,
    BrowserModule,
    BrowserAnimationsModule,
    MatDialogModule,
    MatButtonModule,
    CalendarModule,
    CheckboxModule,
    ConfirmDialogModule,
    DynamicDialogModule,
    DialogModule,
    InputTextModule,
    TooltipModule
    

      
  ],
  providers: [DatePipe,DialogService,ConfirmationService,DynamicDialogConfig] ,
  bootstrap: [AppComponent]
})
export class AppModule { }
