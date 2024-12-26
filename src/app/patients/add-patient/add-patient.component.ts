import { Component, AfterViewInit, ElementRef, ViewChild, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { PatientsService } from '../patients.service';
import { CreatePatient } from '../Models/patient'; 
import { FaceDetection, Results } from '@mediapipe/face_detection'; 
import { FormBuilder } from '@angular/forms';
import { NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-add-patient',
  templateUrl: './add-patient.component.html',
  styleUrls: ['./add-patient.component.css'],

})
export class AddPatientComponent implements AfterViewInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('patientForm') patientForm!: NgForm;
  showSuccessfullyMessage: boolean = false;
  errorDisplay: boolean = false;
  SuccessfullyHeader: string = 'Success';
  SuccessfullyMessage: string = 'Patient saved successfully!';
  errorMessage: string = 'An error occurred while saving the patient.';
  capturedImageUrl: string | null = null;
  capturedImageFile: File | null = null;
  faceDetection: FaceDetection | null = null;
  videoStream: MediaStream | null = null;
  patient:any
  boundingBox: { x: number; y: number; width: number; height: number } | null = null;
  dob:Date
  patientData: CreatePatient = {
    id: 0,
    name: '',
    mobileno: '',
    nationalno: '',
    dob: '',
    faceImg:''
  };
  blob:Blob;
  constructor(private patientsService: PatientsService, 
    private router: Router,
    private fb: FormBuilder,
    private http: HttpClient,
    private ref:DynamicDialogRef,
    private config:DynamicDialogConfig,
    
    ) {
    }

    ngAfterViewInit(): void {}

    openCamera(): void {
      // Ensure the camera isn't reopened if already active
      if (this.videoStream) {
        console.warn('Camera is already open.');
        return;
      }
    
      navigator.mediaDevices
        .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })
        .then((stream) => {
          this.videoStream = stream;
          this.videoElement.nativeElement.srcObject = stream;
          this.videoElement.nativeElement.play();
          this.initFaceDetection();
        })
        .catch((error) => {
          console.error('Error accessing camera:', error);
        });
    }
    
    initFaceDetection(): void {
      this.faceDetection = new FaceDetection({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
      });
    
      // Set options for face detection
      this.faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5,
      });
    
      // Handle detection results
      this.faceDetection.onResults((results: Results) => this.drawFaceBoundaries(results));
    
      // Start processing video frames
      this.processVideo();
    }
    
    drawFaceBoundaries(results: Results): void {
      const canvas = this.canvasElement.nativeElement;
      const ctx = canvas.getContext('2d');
    
      if (!ctx || !results.detections) {
        return;
      }
    
      // Match canvas size to video element
      canvas.width = this.videoElement.nativeElement.videoWidth;
      canvas.height = this.videoElement.nativeElement.videoHeight;
    
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    
      // Draw video frame to canvas
      ctx.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);
    
      // Reset bounding box
      this.boundingBox = null;
    
      // Draw bounding boxes for each detected face
      results.detections.forEach((detection) => {
        const boundingBox = detection.boundingBox;
    
        ctx.strokeStyle = '#00FF00'; // Green bounding box
        ctx.lineWidth = 3; // Thickness of the bounding box
        ctx.strokeRect(
          boundingBox.xCenter * canvas.width - (boundingBox.width * canvas.width) / 2,
          boundingBox.yCenter * canvas.height - (boundingBox.height * canvas.height) / 2,
          boundingBox.width * canvas.width,
          boundingBox.height * canvas.height
        );
    
        // Save bounding box details
        this.boundingBox = {
          x: boundingBox.xCenter * canvas.width - (boundingBox.width * canvas.width) / 2,
          y: boundingBox.yCenter * canvas.height - (boundingBox.height * canvas.height) / 2,
          width: boundingBox.width * canvas.width,
          height: boundingBox.height * canvas.height,
        };
      });
    }
    
    processVideo(): void {
      const video = this.videoElement.nativeElement;
      let frameCount = 0;
    
      const process = () => {
        if (this.faceDetection) {
          try {
            // Process every 10th frame for efficiency
            if (frameCount % 10 === 0) {
              this.faceDetection.send({ image: video });
            }
            frameCount++;
          } catch (error) {
            console.error('Error in face detection:', error);
          }
        }
    
        // Slight delay for smoother processing
        setTimeout(() => requestAnimationFrame(process), 50);
      };
    
      process();
    }
    
    ngOnDestroy(): void {
      // Stop video stream and release resources
      if (this.videoStream) {
        this.videoStream.getTracks().forEach((track) => track.stop());
        this.videoStream = null;
      }
    
      // Close face detection instance if initialized
      if (this.faceDetection) {
        this.faceDetection.close();
        this.faceDetection = null;
      }
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

  onDateChange($event: Event) {
    
    const input = $event.target as HTMLInputElement;
    console.log("input :", typeof(input.value));

    this.patientData.dob = input.value;
  }

  submitForm(): void {
   // console.log("this.isPatientDataValid() :",this.isPatientDataValid());
    
    //if (this.isPatientDataValid()) {
      // this.patientsService.addPatient(this.patientData).subscribe(
      //   (response) => {
      //     console.log('Patient data submitted successfully:', response);
      //     // this.router.navigate(['/patients']); // Redirect to patients page
      //   },
      //   (error) => {
      //     console.error('Error submitting patient data:', error);
      //   }
      // );
      console.log("p :",this.patientData);
      

   
   if(this.patientData.dob =="")
   {
    this.errorDisplay=true;
    this.errorMessage="Patient Date Of Birth is required";
    return;
   }
    
   if(this.patientData.mobileno =="")
    {
     this.errorDisplay=true;
     this.errorMessage="Patient Mobile No is required";
     return;
    }
     
   if(this.patientData.nationalno =="")
    {
     this.errorDisplay=true;
     this.errorMessage="Patient National No is required";
     return;
    }
     
  
      // Upload the patient data first
      this.http.post("https://localhost:7266/api/Patients/addPatient", this.patientData).subscribe(
        (patientIdRes: any) => {
          if(this.blob==undefined)
            {
              console.log("no image");
              this.router.navigate(['/']);
            }

            const formData = new FormData();
            formData.append('file', this.blob, 'captured-face.png');
          // Then upload the image
          this.http.post(`https://localhost:7266/api/Patients/uploadFaceImage/${patientIdRes}`, formData).subscribe(
            (response: any) => {
              console.log('Image uploaded successfully:', response);
              
              // Redirect to patients page after both operations are successful
              this.ref.close("Updated");
            },
            (error) => {
              console.error('Error uploading image:', error);
            }
          );
        },
        (error) => {
          if(error.error.status =="NationalIdExists")
          {
            this.errorDisplay= true;
            this.errorMessage=error.error.errorMsg
          }
          console.error('Error:', error.error.status);
        }
      );
    // } else {
    //   console.warn('Patient data is invalid. Please fill out all fields.');
    // }
   }

  isPatientDataValid(): boolean {
    const nameValid = this.patientData.name.trim().length > 0 && /^[a-zA-Z\s]+$/.test(this.patientData.name);
    console.log("nameValid :",nameValid);
    //make validation in date
    // const dobValid = this.isValidDate(this.patientData.dob);
    // console.log("dobValid :",dobValid);
    
    const mobilenoValid = this.patientData.mobileno.trim().length > 0 && /^\d+$/.test(this.patientData.mobileno);
    console.log("mobilenoValid :",mobilenoValid);
    
    // const nationalnoValid = this.patientData.nationalno.trim().length > 0 && /^\d+$/.test(this.patientData.nationalno);
   // console.log("nationalnoValid :",nationalnoValid);
    
    return nameValid  && mobilenoValid ;
  }

  isValidDate(dob: Date): boolean {
    return dob instanceof Date && !isNaN(dob.getTime());
  }
}
