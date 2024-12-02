import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PatientsRoutingModule } from './patients-routing.module';
import { PatientsComponent } from './patients.component';
import { AddPatientComponent } from './add-patient/add-patient.component';
import { EditPatientComponent } from './edit-patient/edit-patient.component';
import { FormsModule } from '@angular/forms';
// import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog/confirm-delete-dialog.component';
import { DialogService, DynamicDialogModule ,DynamicDialogConfig} from 'primeng/dynamicdialog';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import {ConfirmDialogModule} from 'primeng/confirmdialog'
import { MatDialogModule } from '@angular/material/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { OpenCameraComponent } from './open-camera/open-camera.component';



@NgModule({
  declarations: [
    PatientsComponent,
    AddPatientComponent,
    EditPatientComponent,
    OpenCameraComponent,
    // ConfirmDeleteDialogComponent
  ],
  imports: [
    CommonModule,
    PatientsRoutingModule,
    FormsModule,
    DialogModule,
    ConfirmDialogModule,
    MatDialogModule,
    InputTextModule,
    ButtonModule,
    TooltipModule
  ],
  providers:[DialogService,ConfirmationService,DynamicDialogModule]
})
export class PatientsModule { }
