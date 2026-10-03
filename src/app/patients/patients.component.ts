import { Component, OnInit } from '@angular/core';
import { PatientsService } from './patients.service';
import { ListPatients, PatientResult } from './Models/patient';
import { DialogService } from 'primeng/dynamicdialog';
import { EditPatientComponent } from './edit-patient/edit-patient.component';
import { ConfirmationService } from 'primeng/api';
import { AddPatientComponent } from './add-patient/add-patient.component';
import { OpenCameraComponent } from './open-camera/open-camera.component';
import { PatientParams } from './Models/PatientParams';

@Component({
  selector: 'app-patients',
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.css'],
  providers: [DialogService]
})
export class PatientsComponent implements OnInit {

  showSuccessfullyMessage = false;
  errorDisplay = false;
  SuccessfullyHeader = '';
  SuccessfullyMessage = '';
  errorMessage = '';

  patientParams!: PatientParams;

  patientResult: PatientResult = {
    results: [],
    totalResults: 0
  };

  constructor(
    private patientsService: PatientsService,
    private confirmationService: ConfirmationService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    this.patientParams = {
      first: 0,
      rows: 10,
      searchtext: ''
    };

    this.loadPatients(this.patientParams);
  }

  loadPatients(event: any): void {
    this.patientParams.first = event.first ?? 0;
    this.patientParams.rows = event.rows ?? 10;

    this.patientsService
      .getPatients(this.patientParams)
      .subscribe({
        next: data => {
          this.patientResult = data;
        },
        error: error => {
          console.error('Failed to load patients:', error);
          this.errorDisplay = true;
          this.errorMessage = 'Failed to load patients.';
        }
      });
  }

  onAdd(): void {
    const refDialog = this.dialogService.open(
      AddPatientComponent,
      {
        header: 'Add Patient'
      }
    );

    refDialog.onClose.subscribe(updated => {
      if (updated) {
        this.loadPatients(this.patientParams);
        this.showSuccessfullyMessage = true;
        this.SuccessfullyHeader = 'Added';
        this.SuccessfullyMessage =
          'Patient Added Successfully';
      }
    });
  }

  openCamera(): void {
    const refDialog = this.dialogService.open(
      OpenCameraComponent,
      {
        header: 'Camera Popup'
      }
    );

    refDialog.onClose.subscribe(patient => {
      if (patient) {
        this.patientResult.results = [patient];
        this.patientResult.totalResults = 1;
      }
    });
  }

  onEdit(patient: ListPatients): void {
    const refDialog = this.dialogService.open(
      EditPatientComponent,
      {
        header: 'Edit Patient',
        data: { patientId: patient.id }
      }
    );

    refDialog.onClose.subscribe(updated => {
      if (updated) {
        this.loadPatients(this.patientParams);
        this.showSuccessfullyMessage = true;
        this.SuccessfullyHeader = 'Edited';
        this.SuccessfullyMessage =
          'Patient Edited Successfully';
      }
    });
  }

  confirmDelete(patient: ListPatients): void {
    this.confirmationService.confirm({
      header: 'Delete Confirmation',
      message: 'Are you sure you want to delete this patient?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      accept: () => {
        this.deletePatient(patient.id);
      }
    });
  }

  deletePatient(id: number): void {
    this.patientsService
      .deletePatient(id)
      .subscribe({
        next: () => {
          this.loadPatients(this.patientParams);
          this.showSuccessfullyMessage = true;
          this.SuccessfullyHeader = 'Deleted';
          this.SuccessfullyMessage =
            'Patient Deleted Successfully';
        },
        error: error => {
          console.error('Delete failed:', error);
          this.errorDisplay = true;
          this.errorMessage = 'Failed to delete patient.';
        }
      });
  }

  onSearchh(): void {
    this.patientParams.first = 0;
    this.patientParams.rows = 10;
    this.loadPatients(this.patientParams);
  }
}
