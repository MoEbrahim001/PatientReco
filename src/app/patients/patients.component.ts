import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { PatientsService } from './patients.service';
import { Router } from '@angular/router';
import { ListPatients } from './Models/patient';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators'; 
// import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog/confirm-delete-dialog.component';
import { FaceDetection, Results } from '@mediapipe/face_detection'; 

import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { EditPatientComponent } from './edit-patient/edit-patient.component';
import { ConfirmationService } from 'primeng/api';
import { AddPatientComponent } from './add-patient/add-patient.component';
import { environment } from 'src/environments/environment';
import { OpenCameraComponent } from './open-camera/open-camera.component';

@Component({
  selector: 'app-patients',
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.css'],
    providers: [DialogService, DynamicDialogRef] // Ensure these are provided in the component scope

})
export class PatientsComponent implements OnInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  selectedPatient: any = {};
  showCameraPopup: boolean = false;
  displayDialog: boolean = false;
  capturedImageUrl: string | null = null;
  faceDetection: FaceDetection | null = null;
  videoStream: MediaStream | null = null;
  showSuccessfullyMessage: boolean = false;
  errorDisplay: boolean = false;
  SuccessfullyHeader: string = '';
  SuccessfullyMessage: string = '!';
  errorMessage: string = '';
  boundingBox: { x: number; y: number; width: number; height: number } | null = null;
  patients: ListPatients[] = [];
  searchSubject: Subject<string> = new Subject();
  searchText: string = '';
  searchExecuted: boolean = false;
  capturedImageBlob: Blob | null = null;
  blob:Blob;



  constructor(private patientsService: PatientsService, private router: Router,private dialog:MatDialog,private confirmationService:ConfirmationService
    ,private http: HttpClient, // Inject HttpClient
    private sanitizer: DomSanitizer, private dialogService:DialogService,private ref:DynamicDialogRef,private config:DynamicDialogConfig) {}

  ngOnInit() {
  
      this.loadAllPatients();
  
    // this.searchSubject.pipe(
    //   debounceTime(300), // Wait for 300ms pause in events
    //   switchMap(searchText => this.patientsService.searchPatients(searchText)) // Switch to new observable
    // ).subscribe(data => {
    //   this.patients = data; // Update the patient list with search results
    // });
  }
  loadAllPatients() {
    this.patientsService.getPatients().subscribe((data) => {
      this.patients = data;
      console.log("p empty:",this.patients.length==0);
      console.log("p empty:",this.patients)
      


      
    });
  }
 
  onAdd(): void {
    const refDialog = this.dialogService.open(AddPatientComponent, {
      header: "Add Patient",
    });
  
    refDialog.onClose.subscribe((Updated) => {
      if (Updated) {
        console.log("Updated list of patients");
        this.loadAllPatients();
        this.showSuccessfullyMessage = true;
        this.SuccessfullyHeader='Added'
        this.SuccessfullyMessage='Patient Added SuccessFully'
      }
    });
  }
  // onAdd(patient:ListPatients): void {
  //   var refDialog=this.dialogService.open(AddPatientComponent,{

  //   })

  // }
  // onAdd() {
  //   this.router.navigate(['/patients/add']);
  // }
  openCamera(): void {
    const refDialog = this.dialogService.open(OpenCameraComponent, {
      header: "camer popup",
    });
    refDialog.onClose.subscribe(()=>{
      if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop()); // Stop all tracks (video)
        this.videoStream = null;
      }  
      this.ref.close()  
    })
  }
  stopCamera(): void {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
      console.log('Camera stopped');
    }
  }
  onCancel(): void {
    this.stopCamera(); // Stop the camera feed
    this.router.navigate(['/patient']); // Navigate to patient page
  }
   
  initFaceDetection(): void {
    this.faceDetection = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });

    this.faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5,
    });

    this.faceDetection.onResults((results: any) => {
      this.drawFaceBoundaries(results);
    });

    this.processVideo();
  }

  drawFaceBoundaries(results: Results): void {
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx || !results.detections) {
      return;
    }

    canvas.width = this.videoElement.nativeElement.videoWidth;
    canvas.height = this.videoElement.nativeElement.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);

    this.boundingBox = null; // Reset bounding box

    results.detections.forEach((detection) => {
      const boundingBox = detection.boundingBox;
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        boundingBox.xCenter * canvas.width - (boundingBox.width * canvas.width) / 2,
        boundingBox.yCenter * canvas.height - (boundingBox.height * canvas.height) / 2,
        boundingBox.width * canvas.width,
        boundingBox.height * canvas.height
      );

      this.boundingBox = {
        x: boundingBox.xCenter * canvas.width - (boundingBox.width * canvas.width) / 2,
        y: boundingBox.yCenter * canvas.height - (boundingBox.height * canvas.height) / 2,
        width: boundingBox.width * canvas.width,
        height: boundingBox.height * canvas.height
      };
    });
  }

  processVideo(): void {
    const video = this.videoElement.nativeElement;
    let frameCount = 0;

    const process = () => {
      if (this.faceDetection) {
        try {
          if (frameCount % 10 === 0) {
            this.faceDetection.send({ image: video });
          }
          frameCount++;
        } catch (error) {
          console.error('Error in face detection:', error);
        }
      }
      requestAnimationFrame(process);
    };

    process();
  }

  // openCameraPopup(): void {
  //   this.showCameraPopup = true;
  //   this.openCamera();
  // }
  
  closeCamera(): void {
    this.showCameraPopup = false;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
    }
    this.videoStream = null;
  }
  
  captureImage(): void {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');
  
    if (ctx && this.boundingBox) {
      const { x, y, width, height } = this.boundingBox;
  
      // Draw face on a smaller canvas
      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = width;
      faceCanvas.height = height;
      const faceCtx = faceCanvas.getContext('2d');
      faceCtx?.drawImage(video, x, y, width, height, 0, 0, width, height);
  
      // Convert faceCanvas to Blob
      const dataUrl = faceCanvas.toDataURL('image/png');
      this.blob = this.dataURLtoBlob(dataUrl);
  
      // Redirect to the patients page after capturing
      this.closeCamera();
      this.router.navigate(['/patients']);
    } else {
      console.error('No bounding box detected.');
    }
  }
  dataURLtoBlob(dataURL: string): Blob {
    const [mimeString, bstr] = dataURL.split(',');
    const mime = mimeString.match(/:(.*?);/)![1];
    const u8arr = Uint8Array.from(atob(bstr), (c) => c.charCodeAt(0));
    return new Blob([u8arr], { type: mime });
  }
  


 
  
  // onDeleteAll(): void {
  //   const dialogRef = this.dialog.open(ConfirmDeleteAllDialogComponent);
  
  //   dialogRef.afterClosed().subscribe((confirmed: boolean) => {
  //     if (confirmed) {
  //       this.patientsService.deleteAllPatients().subscribe(
  //         () => {
  //           this.loadAllPatients(); // Reload the list after deletion
  //         },
  //         (error) => {
  //           console.error("Error deleting patients", error);
  //         }
  //       );
  //     }
  //   });
  // }
  
  
  
 
  onSearch() {
    if (this.searchText.trim()) {
      this.patientsService.searchPatients(this.searchText).subscribe((data) => {
        this.patients = data;
        this.searchExecuted = true; // Set to true after executing search
      });
    } else {
      // Optionally, reset the list if the search text is empty
      this.loadAllPatients();
      this.searchExecuted = false;
    }
  }
  onEdit(patient: ListPatients): void {
    var refDialog=this.dialogService.open(EditPatientComponent,{
      header:"Edit Patient",
      // width:'80%',
      data:{
        patientId:patient.id
      }
      })
      refDialog.onClose.subscribe((Updated)=>{
        if(Updated)
        {
          this.loadAllPatients();
          this.showSuccessfullyMessage = true;
          this.SuccessfullyHeader='Edited';
          this.SuccessfullyMessage='Patient Edited SuccessFully';

          console.log("Updated list p");
        }
      })
  }
  // onEdit(patient: ListPatients): void {
  //   const dialogRef = this.dialog.open(EditPatientDialogComponent, {
  //     width: '500px',
  //     data: { patient }
  //   });

  //   dialogRef.afterClosed().subscribe((updatedPatient: any) => {
  //     if (updatedPatient) {
  //       // Handle the updated patient data here, e.g., send it to the server
  //       console.log('Updated Patient:', updatedPatient);
  //     }
  //   });
  // }
  deletePatient(id: number) {
    // Your delete API logic here
    console.log(`Deleting patient with ID: ${id}`);
    // Example API call
    this.patientsService.deletePatient(id).subscribe(() => {
      this.loadAllPatients();
      this.showSuccessfullyMessage = true;
      this.SuccessfullyHeader='Deleted'
      this.SuccessfullyMessage='Patient Deleted SuccessFully'
      console.log("Patient deleted successfully");

    });
  }
  // Method to confirm deletion
  confirmDelete(patient: any): void {
    this.confirmationService.confirm({
      header: "Delete Confirmation",
      message: `Are you sure you want to delete this patient?`,
      icon: 'pi pi-exclamation-triangle', // optional icon
      acceptLabel: "No", // Changed from "Yes" to "No"
      rejectLabel: "Yes", // Changed from "No" to "Yes"
      
      accept: () => {
        // Do nothing, as this is the "No" button now
        console.log("Deletion canceled");
      },
      reject: () => {
        // Call delete API on confirmation
        this.deletePatient(patient.id);
      }
    });
  }
  
  async captureAndDetectFace() {
    // Convert canvas to a Blob and send to backend
    const canvas = this.canvasElement.nativeElement;
    canvas.toBlob(async (blob) => {
      if (blob) {
        const formData = new FormData();
        formData.append('file', blob, 'face_image.png');

        // Make API call to send captured image
        try {
          const response = await fetch('https://localhost:7266/api/Patients/detectAndFind', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          console.log(result);
          if (result.isMatch) {
            alert(`Patient Found`);
          } else {
            alert('No matching patient found.');
          }
        } catch (error) {
          console.error('Error during face detection', error);
        }
      }
    }, 'image/png');
  }

}