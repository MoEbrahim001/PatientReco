import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  FaceLandmarker,
  FaceLandmarkerResult,
  FilesetResolver
} from '@mediapipe/tasks-vision';

import { PatientsService } from '../patients.service';
import { CreatePatient } from '../Models/patient';

@Component({
  selector: 'app-add-patient',
  templateUrl: './add-patient.component.html',
  styleUrls: ['./add-patient.component.css']
})
export class AddPatientComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement', { static: false })
  videoElement!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvasElement', { static: false })
  canvasElement!: ElementRef<HTMLCanvasElement>;

  @ViewChild('patientForm')
  patientForm!: NgForm;

  showSuccessfullyMessage = false;
  errorDisplay = false;

  SuccessfullyHeader = 'Success';
  SuccessfullyMessage = 'Patient saved successfully!';
  errorMessage = 'An error occurred while saving the patient.';

  videoStream: MediaStream | null = null;
  blob!: Blob;

  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;

  dob!: Date;

  patientData: CreatePatient = {
    id: 0,
    name: '',
    mobileno: '',
    nationalno: '',
    dob: '',
    faceImg: ''
  };

  // ---------------- Human / liveness detection ----------------

  private faceLandmarker: FaceLandmarker | null = null;
  private animationFrameId: number | null = null;
  private lastVideoTime = -1;

  livenessPassed = false;
  faceDetected = false;
  livenessMessage = 'Open the camera and look directly at it.';

  private eyesWereOpen = false;
  private eyesWereClosed = false;

  constructor(
    private patientsService: PatientsService,
    private router: Router,
    private http: HttpClient,
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig
  ) {}

  ngAfterViewInit(): void {}

  async openCamera(): Promise<void> {
    if (this.videoStream) {
      console.warn('Camera is already open.');
      return;
    }

    this.resetLiveness();
    this.livenessMessage = 'Starting camera...';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      this.videoStream = stream;

      const video = this.videoElement.nativeElement;
      video.srcObject = stream;
      await video.play();

      await this.initFaceLandmarker();

      this.livenessMessage = 'Face not verified yet. Look at the camera and blink.';
    } catch (error) {
      console.error('Error accessing camera:', error);

      this.errorDisplay = true;
      this.errorMessage = 'Unable to access the camera.';
      this.stopCameraProcessing();
    }
  }

  private async initFaceLandmarker(): Promise<void> {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );

    this.faceLandmarker = await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
        },
        runningMode: 'VIDEO',
        numFaces: 2,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.65,
        minFacePresenceConfidence: 0.65,
        minTrackingConfidence: 0.65
      }
    );

    this.processVideo();
  }

  private processVideo(): void {
    const video = this.videoElement.nativeElement;

    const process = () => {
      if (
        this.faceLandmarker &&
        this.videoStream &&
        video.readyState >= 2 &&
        video.currentTime !== this.lastVideoTime
      ) {
        this.lastVideoTime = video.currentTime;

        const result = this.faceLandmarker.detectForVideo(
          video,
          performance.now()
        );

        this.handleFaceResult(result);
      }

      if (this.videoStream) {
        this.animationFrameId = requestAnimationFrame(process);
      }
    };

    process();
  }

  private handleFaceResult(result: FaceLandmarkerResult): void {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const faces = result.faceLandmarks ?? [];

    // Require exactly one real face.
    if (faces.length === 0) {
      this.faceDetected = false;
      this.boundingBox = null;
      this.resetBlinkOnly();
      this.livenessMessage = 'No human face detected.';
      return;
    }

    if (faces.length > 1) {
      this.faceDetected = false;
      this.boundingBox = null;
      this.resetBlinkOnly();
      this.livenessMessage = 'More than one face detected. Keep only one person in view.';
      return;
    }

    const landmarks = faces[0];

    const box = this.getFaceBoundingBox(
      landmarks,
      canvas.width,
      canvas.height
    );

    if (!box) {
      this.faceDetected = false;
      this.boundingBox = null;
      this.resetBlinkOnly();
      this.livenessMessage = 'Move closer and keep your full face visible.';
      return;
    }

    this.faceDetected = true;
    this.boundingBox = box;

    ctx.strokeStyle = this.livenessPassed ? '#16a34a' : '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(
      box.x,
      box.y,
      box.width,
      box.height
    );

    this.processBlink(result);
  }

  private getFaceBoundingBox(
    landmarks: Array<{ x: number; y: number }>,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number; width: number; height: number } | null {
    if (!landmarks.length) {
      return null;
    }

    const xs = landmarks.map(point => point.x);
    const ys = landmarks.map(point => point.y);

    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    const normalizedWidth = maxX - minX;
    const normalizedHeight = maxY - minY;

    // Reject tiny / accidental detections such as random objects.
    if (
      normalizedWidth < 0.16 ||
      normalizedHeight < 0.20
    ) {
      return null;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Require the detected face to be reasonably inside the frame.
    if (
      centerX < 0.15 ||
      centerX > 0.85 ||
      centerY < 0.12 ||
      centerY > 0.88
    ) {
      return null;
    }

    const padX = normalizedWidth * 0.22;
    const padTop = normalizedHeight * 0.35;
    const padBottom = normalizedHeight * 0.22;

    minX = Math.max(0, minX - padX);
    maxX = Math.min(1, maxX + padX);
    minY = Math.max(0, minY - padTop);
    maxY = Math.min(1, maxY + padBottom);

    const x = minX * canvasWidth;
    const y = minY * canvasHeight;
    const width = (maxX - minX) * canvasWidth;
    const height = (maxY - minY) * canvasHeight;

    return { x, y, width, height };
  }

  private processBlink(result: FaceLandmarkerResult): void {
    if (this.livenessPassed) {
      this.livenessMessage = 'Live human verified. Ready to capture.';
      return;
    }

    const blendshapes = result.faceBlendshapes;

    if (!blendshapes || blendshapes.length !== 1) {
      this.livenessMessage = 'Face detected. Keep looking at the camera.';
      return;
    }

    const categories = blendshapes[0].categories;

    const leftBlink =
      categories.find(x => x.categoryName === 'eyeBlinkLeft')?.score ?? 0;

    const rightBlink =
      categories.find(x => x.categoryName === 'eyeBlinkRight')?.score ?? 0;

    const eyesOpen =
      leftBlink < 0.25 &&
      rightBlink < 0.25;

    const eyesClosed =
      leftBlink > 0.55 &&
      rightBlink > 0.55;

    if (!this.eyesWereOpen) {
      if (eyesOpen) {
        this.eyesWereOpen = true;
        this.livenessMessage = 'Human face detected. Blink once to verify.';
      } else {
        this.livenessMessage = 'Open your eyes and look at the camera.';
      }

      return;
    }

    if (
      this.eyesWereOpen &&
      !this.eyesWereClosed &&
      eyesClosed
    ) {
      this.eyesWereClosed = true;
      this.livenessMessage = 'Good. Open your eyes.';
      return;
    }

    if (
      this.eyesWereOpen &&
      this.eyesWereClosed &&
      eyesOpen
    ) {
      this.livenessPassed = true;
      this.livenessMessage = 'Live human verified. Ready to capture.';
      console.log('HUMAN LIVENESS PASSED');
    }
  }

  captureImage(): void {
    if (!this.livenessPassed || !this.faceDetected || !this.boundingBox) {
      this.errorDisplay = true;
      this.errorMessage =
        'A live human face must be detected and verified before capturing.';
      return;
    }

    const video = this.videoElement.nativeElement;
    const previewCanvas = this.canvasElement.nativeElement;

    const {
      x,
      y,
      width,
      height
    } = this.boundingBox;

    const sourceX = Math.max(0, Math.floor(x));
    const sourceY = Math.max(0, Math.floor(y));
    const sourceWidth = Math.min(
      video.videoWidth - sourceX,
      Math.floor(width)
    );
    const sourceHeight = Math.min(
      video.videoHeight - sourceY,
      Math.floor(height)
    );

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      this.errorDisplay = true;
      this.errorMessage = 'Unable to capture a valid face image.';
      return;
    }

    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = sourceWidth;
    faceCanvas.height = sourceHeight;

    const faceCtx = faceCanvas.getContext('2d');

    if (!faceCtx) {
      return;
    }

    faceCtx.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    faceCanvas.toBlob(
      blob => {
        if (!blob) {
          this.errorDisplay = true;
          this.errorMessage = 'Could not create the captured image.';
          return;
        }

        this.blob = blob;

        this.stopCameraProcessing();

        // Show the final cropped face in the visible canvas.
        const previewCtx = previewCanvas.getContext('2d');

        if (previewCtx) {
          previewCanvas.width = sourceWidth;
          previewCanvas.height = sourceHeight;

          previewCtx.clearRect(
            0,
            0,
            sourceWidth,
            sourceHeight
          );

          previewCtx.drawImage(
            faceCanvas,
            0,
            0,
            sourceWidth,
            sourceHeight
          );
        }

        this.livenessMessage = 'Image captured successfully.';
        console.log('Verified human face captured.');
      },
      'image/png',
      1
    );
  }

  private resetBlinkOnly(): void {
    if (this.livenessPassed) {
      return;
    }

    this.eyesWereOpen = false;
    this.eyesWereClosed = false;
  }

  private resetLiveness(): void {
    this.livenessPassed = false;
    this.faceDetected = false;

    this.eyesWereOpen = false;
    this.eyesWereClosed = false;

    this.boundingBox = null;
    this.lastVideoTime = -1;
  }

  private stopCameraProcessing(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }

    if (this.videoStream) {
      this.videoStream
        .getTracks()
        .forEach(track => track.stop());

      this.videoStream = null;
    }

    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      video.pause();
      video.srcObject = null;
    }
  }

  ngOnDestroy(): void {
    this.stopCameraProcessing();
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.patientData.dob = input.value;
  }

  submitForm(): void {
    if (this.patientData.dob === '') {
      this.errorDisplay = true;
      this.errorMessage = 'Patient Date Of Birth is required';
      return;
    }

    if (this.patientData.mobileno === '') {
      this.errorDisplay = true;
      this.errorMessage = 'Patient Mobile No is required';
      return;
    }

    if (this.patientData.nationalno === '') {
      this.errorDisplay = true;
      this.errorMessage = 'Patient National No is required';
      return;
    }

    this.http
      .post(
        'https://localhost:7183/api/Patients/addPatient',
        this.patientData
      )
      .subscribe(
        (patientIdRes: any) => {
          if (!this.blob) {
            console.log('No image uploaded');
            this.router.navigate(['/']);
            return;
          }

          const formData = new FormData();

          formData.append(
            'file',
            this.blob,
            'captured-face.png'
          );

          this.http
            .post(
              `https://localhost:7183/api/Patients/uploadFaceImage/${patientIdRes}`,
              formData
            )
            .subscribe(
              (response: any) => {
                console.log(
                  'Image uploaded successfully:',
                  response
                );

                this.ref.close('Updated');
              },
              error => {
                console.error(
                  'Error uploading image:',
                  error
                );

                this.errorDisplay = true;
                this.errorMessage = 'Failed to upload face image.';
              }
            );
        },
        error => {
          if (error?.error?.status === 'NationalIdExists') {
            this.errorDisplay = true;
            this.errorMessage = error.error.errorMsg;
          }

          console.error(
            'Error:',
            error?.error?.status ?? error
          );
        }
      );
  }

  isPatientDataValid(): boolean {
    const nameValid =
      this.patientData.name.trim().length > 0 &&
      /^[a-zA-Z\s]+$/.test(this.patientData.name);

    const mobilenoValid =
      this.patientData.mobileno.trim().length > 0 &&
      /^\d+$/.test(this.patientData.mobileno);

    return nameValid && mobilenoValid;
  }

  isValidDate(dob: Date): boolean {
    return dob instanceof Date && !isNaN(dob.getTime());
  }
}
