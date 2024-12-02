import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientsService } from '../patients.service';
import { CreatePatient, Editpatient, ListPatients, viewPatient } from '../Models/patient';
import { FaceDetection, Results } from '@mediapipe/face_detection';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';


@Component({
  selector: 'app-edit-patient',
  templateUrl: './edit-patient.component.html',
  styleUrls: ['./edit-patient.component.css'],


})
export class EditPatientComponent implements OnInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  showSuccessfullyMessage: boolean = false;
  errorDisplay: boolean = false;
  SuccessfullyHeader: string = 'Success';
  SuccessfullyMessage: string = 'Patient saved successfully!';
  errorMessage: string = 'An error occurred while saving the patient.';
  capturedImageUrl: string | null = null;
  faceDetection: FaceDetection | null = null;
  videoStream: MediaStream | null = null;
  boundingBox: { x: number; y: number; width: number; height: number } | null = null;
  blob:Blob;
  dob:Date;
  patient: viewPatient = {
    id: 0,
    name: '',
    mobileno: '',
    nationalno: '',
     dob:new Date(),

    faceImg: '' // Ensure this is defined
  };
  editpatient:Editpatient={   
    id: 0,
    name: '',
    mobileno: '',
    nationalno: '',dob:new Date,strDob:'',dobdate: new Date,faceImg:''}
  constructor(
    private http:HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private patientsService: PatientsService,private datePipe:DatePipe,private ref:DynamicDialogRef,private config:DynamicDialogConfig
  ) {}

  ngOnInit(): void {
    // const id = +this.route.snapshot.paramMap.get('id')!;
    // console.log('Route ID:', id); // Log the ID from the URL
    var id=this.config.data.patientId
    console.log("id :",id);
    
    this.patientsService.getPatientById(id).subscribe((data) => {
      // Convert dob to Date object if it's a string
      console.log("id after getbyid:",data);
      
     // this.patient = { ...data, dob: new Date(data.dob) };
      this.editpatient= data;
      this.editpatient.dob = new Date( this.editpatient.dob);
    });
  }


  openCamera(): void {
    navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    }).then((stream) => {
      this.videoStream = stream;
      this.videoElement.nativeElement.srcObject = stream;
      this.videoElement.nativeElement.play();
      this.initFaceDetection();
    }).catch((error) => {
      console.error('Error accessing camera:', error);
    });
  }
  onDateChange(event: any) {
    const formattedDate = this.datePipe.transform(event, 'MM-dd-yyyy');
    console.log('Formatted date:', formattedDate);
        this.editpatient.strDob = this.datePipe.transform(event, 'MM-dd-yyyy');;

    // Use the formatted string as needed
  }
  // onDateChange($event: Event) {
  //   // const input = $event.target as HTMLInputElement;
  //   // this.Editpatient.dob = input.value;
  //   console.log("event :", $event.returnValue);

  //   console.log("date change");

  // }
  initFaceDetection(): void {
    this.faceDetection = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });

    this.faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5,
    });

    this.faceDetection.onResults((results: Results) => {
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

  // onSave(): void {
  //   const formData = new FormData();

  //   formData.append('id', this.patient.id.toString());
  //   formData.append('name', this.patient.name);
  //   formData.append('mobileno', this.patient.mobileno);
  //   formData.append('dob', this.patient.dob);
  //   formData.append('nationalno', this.patient.nationalno);

  //   this.patientsService.updatePatient(formData).subscribe(() => {
  //     this.router.navigate(['/']); // Redirect to patients list after saving
  //   });
  // }
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
      console.log("Image captured and blob created");
  
      // Stop the camera stream
      if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop());
        console.log("Camera stopped.");
      }
  
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
  // getFormattedDate(): string {
  //   const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  //   return this.dob.toLocaleDateString('en-US', options); // Adjust the locale if needed
  // }
  submitForm(): void {
    console.log("Editpatient:", this.editpatient);
    
    this.patientsService.updatePatient(this.editpatient).subscribe({
      next: (data) => {
        if (this.blob) {
          const formData = new FormData();
          formData.append('file', this.blob, 'captured-face.png');
          
          this.http.post(`https://localhost:7266/api/Patients/uploadFaceImage/${this.editpatient.id}`, formData).subscribe(
            (uploadResponse: any) => {
              console.log('Image uploaded successfully:', uploadResponse);
              
              // Show success dialog when both patient update and image upload are successful
              this.showSuccessfullyMessage = true;
              
              // Redirect to the patients page after displaying the success message
              this.ref.close("Updated");
            },
            (uploadError: any) => {
              console.error('Image upload failed:', uploadError);
              
              // Show error dialog if image upload fails
              this.errorMessage = 'Failed to upload image';
              this.errorDisplay = true;
            }
          );
        } else {
          // No image uploaded, set success dialog for patient data update
          this.showSuccessfullyMessage = true;
          this.ref.close("Updated");
        }
      },
      error: (updateError: any) => {
        console.error('Patient update failed:', updateError);
        
        // Show error dialog if patient update fails
        this.errorMessage = 'Failed to update patient data';
        this.errorDisplay = true;
      }
    });
    
    console.log("No image uploaded, navigating to homepage.");
  }
  

     
      
   // Step 1: Update patient data first
  //  this.http.put(`http://localhost:7266/api/Patients/UpdatePatient`, this.editpatient).subscribe(
  //     (response: any) => {
  //        console.log('Patient data updated successfully:', response);

  //        if (!this.blob) {
  //           console.log("No image uploaded, navigating to homepage.");
  //           this.router.navigate(['/']);
  //           return; // Exit if no image
  //        }

  // // //        // Step 2: If an image is captured, upload it
  //        const formData = new FormData();
  //        formData.append('file', this.blob, 'captured-face.png');

  //       //  this.http.post(`https://localhost:7266/api/Patients/uploadFaceImage/${id}`, formData).subscribe(
  //       //     (response: any) => {
  //       //        console.log('Image uploaded successfully:', response);
  //       //        this.router.navigate(['/']); // Redirect after both operations
  //       //     },
  //       //     (error) => {
  //       //        console.error('Error uploading image:', error);
  //       //     }
  //       //  );
  //     },
  //     (error) => {
  //        console.error('Error updating patient data:', error);
  //     }
  //   );
   
    
}



 // Upload the patient data first
    // this.http.post("https://localhost:7266/api/Patients/addPatient", this.Editpatient).subscribe(
    //   (patientIdRes: any) => {
    //     if(this.blob==undefined)
    //       {
    //         console.log("no image");
    //         this.router.navigate(['/']);
    //       }

    //       const formData = new FormData();
    //       formData.append('file', this.blob, 'captured-face.png');
    //     // Then upload the image
    //     this.http.post(`https://localhost:7266/api/Patients/uploadFaceImage/${patientIdRes}`, formData).subscribe(
    //       (response: any) => {
    //         console.log('Image uploaded successfully:', response);

    //         // Redirect to patients page after both operations are successful
    //         this.router.navigate(['/']);
    //       },
    //       (error) => {
    //         console.error('Error uploading image:', error);
    //       }
    //     );
    //   },
    //   (error) => {
    //     console.error('Error:', error);
    //   }
    // );
  // } else {
  //   console.warn('Patient data is invalid. Please fill out all fields.');

