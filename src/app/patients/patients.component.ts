import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { PatientsService } from './patients.service';
import { Router } from '@angular/router';
import { ListPatients, PatientResult } from './Models/patient';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators'; 
import { FaceDetection, Results } from '@mediapipe/face_detection'; 
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { EditPatientComponent } from './edit-patient/edit-patient.component';
import { ConfirmationService } from 'primeng/api';
import { AddPatientComponent } from './add-patient/add-patient.component';
import { OpenCameraComponent } from './open-camera/open-camera.component';
import { PatientParams } from './Models/PatientParams';

@Component({
  selector: 'app-patients',
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.css'],
  providers: [DialogService, DynamicDialogRef] // Ensure these are provided in the component scope
})
export class PatientsComponent implements OnInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;

  // State variables
  selectedPatient: any = {};
  showCameraPopup: boolean = false;
  displayDialog: boolean = false;
  capturedImageUrl: string | null = null;
  faceDetection: FaceDetection | null = null;
  videoStream: MediaStream | null = null;
  showSuccessfullyMessage: boolean = false;
  errorDisplay: boolean = false;
  SuccessfullyHeader: string = '';
  SuccessfullyMessage: string = '';
  errorMessage: string = '';
  boundingBox: { x: number; y: number; width: number; height: number } | null = null;
  searchExecuted: boolean = false;
  patientParams: PatientParams;
  patientResult: PatientResult = { results: [], totalResults: 0 };
  searchSubject: Subject<string> = new Subject();
  capturedImageBlob: Blob | null = null;
  blob: Blob;

  constructor(
    private patientsService: PatientsService,
    private router: Router,
    private dialog: MatDialog,
    private confirmationService: ConfirmationService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private dialogService: DialogService,
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig
  ) {}

  ngOnInit() {
    this.patientParams = { first: 0, rows: 10 , searchtext:''};

    // Debounced search functionality
    this.searchSubject.pipe(
      debounceTime(300),
      switchMap((searchText) => this.patientsService.searchPatients(searchText))
    ).subscribe((data) => {
      this.patientResult.results = data;
      this.searchExecuted = true;
    });

    // Load initial patients
    this.loadPatients(this.patientParams);
  }

  loadPatients(event: any): void {
    this.patientParams.first = event.first;
    this.patientParams.rows = event.rows;

    this.patientsService.getPatients(this.patientParams).subscribe((data) => {
      this.patientResult = data;
    });
  }

  onAdd(): void {
    const refDialog = this.dialogService.open(AddPatientComponent, {
      header: 'Add Patient',
    });

    refDialog.onClose.subscribe((updated) => {
      if (updated) {
        this.loadPatients(this.patientParams);
        this.showSuccessfullyMessage = true;
        this.SuccessfullyHeader = 'Added';
        this.SuccessfullyMessage = 'Patient Added Successfully';
      }
    });
  }

  openCamera(): void {
    const refDialog = this.dialogService.open(OpenCameraComponent, {
      header: 'Camera Popup',
    });

    refDialog.onClose.subscribe((patient) => {
      if (patient) {
        this.patientResult.results = [patient];
        this.patientResult.totalResults = 1;
      }
      if (this.videoStream) {
        this.videoStream.getTracks().forEach((track) => track.stop());
        this.videoStream = null;
      }
      this.ref.close();
    });
  }

  stopCamera(): void {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
    }
  }

  onCancel(): void {
    this.stopCamera();
    this.router.navigate(['/patients']);
  }

  onEdit(patient: ListPatients): void {
    const refDialog = this.dialogService.open(EditPatientComponent, {
      header: 'Edit Patient',
      data: { patientId: patient.id },
    });

    refDialog.onClose.subscribe((updated) => {
      if (updated) {
        this.loadPatients(this.patientParams);
        this.showSuccessfullyMessage = true;
        this.SuccessfullyHeader = 'Edited';
        this.SuccessfullyMessage = 'Patient Edited Successfully';
      }
    });
  }

  confirmDelete(patient: any): void {
    this.confirmationService.confirm({
      header: 'Delete Confirmation',
      message: 'Are you sure you want to delete this patient?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      accept: () => {
        this.deletePatient(patient.id);
      },
    });
  }

  deletePatient(id: number): void {
    this.patientsService.deletePatient(id).subscribe(() => {
      this.loadPatients(this.patientParams);
      this.showSuccessfullyMessage = true;
      this.SuccessfullyHeader = 'Deleted';
      this.SuccessfullyMessage = 'Patient Deleted Successfully';
    });
  }

  captureImage(): void {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (ctx && this.boundingBox) {
      const { x, y, width, height } = this.boundingBox;

      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = width;
      faceCanvas.height = height;
      const faceCtx = faceCanvas.getContext('2d');
      faceCtx?.drawImage(video, x, y, width, height, 0, 0, width, height);

      const dataUrl = faceCanvas.toDataURL('image/png');
      this.blob = this.dataURLtoBlob(dataUrl);

      this.closeCamera();
      this.router.navigate(['/patients']);
    }
  }

  dataURLtoBlob(dataURL: string): Blob {
    const [mimeString, bstr] = dataURL.split(',');
    const mime = mimeString.match(/:(.*?);/)![1];
    const u8arr = Uint8Array.from(atob(bstr), (c) => c.charCodeAt(0));
    return new Blob([u8arr], { type: mime });
  }

  async captureAndDetectFace(): Promise<void> {
    const canvas = this.canvasElement.nativeElement;
    canvas.toBlob(async (blob) => {
      if (blob) {
        const formData = new FormData();
        formData.append('file', blob, 'face_image.png');

        try {
          const response = await fetch('https://localhost:7266/api/Patients/detectAndFind', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          alert(result.isMatch ? 'Patient Found' : 'No matching patient found.');
        } catch (error) {
          console.error('Error during face detection', error);
        }
      }
    }, 'image/png');
  }

  onSearch(): void {
    if (this.patientParams.searchtext.trim()) {
      this.patientParams.first=0;
      this.patientParams.rows=10;
      this.loadPatients(this.patientParams);
    } else {
      this.loadPatients(this.patientParams);
      this.searchExecuted = false;
    }
  }
  closeCamera(): void {
    this.showCameraPopup = false;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
    }
    this.videoStream = null;
  }
  
}
