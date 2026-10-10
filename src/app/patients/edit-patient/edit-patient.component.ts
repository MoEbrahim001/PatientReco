import {

  Component,

  ElementRef,

  OnDestroy,

  OnInit,

  ViewChild

} from '@angular/core';

import { DatePipe } from '@angular/common';

import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

import {

  FaceLandmarker,

  FaceLandmarkerResult
} from '@mediapipe/tasks-vision';



import { PatientsService } from '../patients.service';

import { FaceLandmarkerService } from '../face-landmarker.service';
import {

  Editpatient,

  viewPatient

} from '../Models/patient';



@Component({

  selector: 'app-edit-patient',

  templateUrl: './edit-patient.component.html',

  styleUrls: ['./edit-patient.component.css']

})

export class EditPatientComponent implements OnInit, OnDestroy {

  @ViewChild('videoElement', { static: false })

  videoElement!: ElementRef<HTMLVideoElement>;



  @ViewChild('canvasElement', { static: false })

  canvasElement!: ElementRef<HTMLCanvasElement>;



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



  patient: viewPatient = {

    id: 0,

    name: '',

    mobileno: '',

    nationalno: '',

    dob: new Date(),

    faceImg: ''

  };



  editpatient: Editpatient = {

    id: 0,

    name: '',

    mobileno: '',

    nationalno: '',

    dob: new Date(),

    strDob: '',

    dobdate: new Date(),

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



  private livenessVerifiedAt = 0;

  private readonly LIVENESS_MAX_AGE_MS = 1200;

  private captureInProgress = false;



  constructor(

    private patientsService: PatientsService,

    private datePipe: DatePipe,

    private ref: DynamicDialogRef,

    private config: DynamicDialogConfig,

    private faceLandmarkerService: FaceLandmarkerService

  ) {}



  ngOnInit(): void {

    const id = this.config.data.patientId;



    this.patientsService

      .getPatientById(id)

      .subscribe(data => {

        this.editpatient = data;

        this.editpatient.dob = new Date(

          this.editpatient.dob

        );

      });

  }



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



      this.livenessMessage =

        'Face not verified yet. Look at the camera and blink.';

    } catch (error) {

      console.error('Error accessing camera:', error);



      this.errorDisplay = true;

      this.errorMessage = 'Unable to access the camera.';

      this.stopCameraProcessing();

    }

  }



  private async initFaceLandmarker(): Promise<void> {

      const startedAt = performance.now();

      this.faceLandmarker =
        await this.faceLandmarkerService.getFaceLandmarker();

      console.log(
        `[PERF][ANGULAR] FaceLandmarker ready = ` +
        `${(performance.now() - startedAt).toFixed(0)} ms`
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



    if (faces.length === 0) {

      this.faceDetected = false;

      this.boundingBox = null;

      this.invalidateLiveness('No human face detected.');

      return;

    }



    if (faces.length > 1) {

      this.faceDetected = false;

      this.boundingBox = null;

      this.invalidateLiveness(

        'More than one face detected. Keep only one person in view.'

      );

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

      this.invalidateLiveness(

        'Move closer and keep your full face visible.'

      );

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



    if (

      normalizedWidth < 0.16 ||

      normalizedHeight < 0.20

    ) {

      return null;

    }



    const centerX = (minX + maxX) / 2;

    const centerY = (minY + maxY) / 2;



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



    return {

      x: minX * canvasWidth,

      y: minY * canvasHeight,

      width: (maxX - minX) * canvasWidth,

      height: (maxY - minY) * canvasHeight

    };

  }



  private processBlink(result: FaceLandmarkerResult): void {

    if (this.livenessPassed) {

      if (!this.isLivenessFresh() && !this.captureInProgress) {

        this.invalidateLiveness('Verification expired. Blink again.');

        return;

      }



      this.livenessMessage = this.captureInProgress

        ? 'Verified. Capturing this same live face...'

        : 'Live human verified.';

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



    const eyesOpen = leftBlink < 0.25 && rightBlink < 0.25;

    const eyesClosed = leftBlink > 0.55 && rightBlink > 0.55;



    if (!this.eyesWereOpen) {

      if (eyesOpen) {

        this.eyesWereOpen = true;

        this.livenessMessage = 'Human face detected. Blink once to verify.';

      } else {

        this.livenessMessage = 'Open your eyes and look at the camera.';

      }

      return;

    }



    if (this.eyesWereOpen && !this.eyesWereClosed && eyesClosed) {

      this.eyesWereClosed = true;

      this.livenessMessage = 'Good. Open your eyes.';

      return;

    }



    if (this.eyesWereOpen && this.eyesWereClosed && eyesOpen) {

      this.livenessPassed = true;

      this.livenessVerifiedAt = performance.now();

      this.livenessMessage = 'Live human verified. Capturing immediately...';

      console.log('HUMAN LIVENESS PASSED');



      // Capture immediately after liveness so the verified person

      // cannot be swapped with a photo or another face before capture.

      queueMicrotask(() => this.captureImage());

    }

  }



  captureImage(): void {

    if (this.captureInProgress) {

      return;

    }



    if (

      !this.livenessPassed ||

      !this.isLivenessFresh() ||

      !this.faceDetected ||

      !this.boundingBox

    ) {

      this.errorDisplay = true;

      this.errorMessage =

        'A fresh live human verification is required before capturing. Blink again.';

      this.invalidateLiveness('Verification expired. Blink again.');

      return;

    }



    this.captureInProgress = true;

    this.livenessMessage = 'Verified. Capturing this same live face...';



    const video = this.videoElement.nativeElement;

    const previewCanvas = this.canvasElement.nativeElement;

    const { x, y, width, height } = this.boundingBox;



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

      this.captureInProgress = false;

      this.errorDisplay = true;

      this.errorMessage = 'Unable to capture a valid face image.';

      this.invalidateLiveness('Unable to capture the face. Blink again.');

      return;

    }



    const faceCanvas = document.createElement('canvas');

    faceCanvas.width = sourceWidth;

    faceCanvas.height = sourceHeight;



    const faceCtx = faceCanvas.getContext('2d');

    if (!faceCtx) {

      this.captureInProgress = false;

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

          this.captureInProgress = false;

          this.errorDisplay = true;

          this.errorMessage = 'Could not create the captured image.';

          this.invalidateLiveness('Capture failed. Blink again.');

          return;

        }



        this.blob = blob;

        this.stopCameraProcessing();



        const previewCtx = previewCanvas.getContext('2d');

        if (previewCtx) {

          previewCanvas.width = sourceWidth;

          previewCanvas.height = sourceHeight;

          previewCtx.clearRect(0, 0, sourceWidth, sourceHeight);

          previewCtx.drawImage(faceCanvas, 0, 0, sourceWidth, sourceHeight);

        }



        this.captureInProgress = false;

        this.livenessMessage = 'Verified live face captured securely.';

        console.log('Verified human face captured immediately after liveness.');

      },

      'image/jpeg',

      0.88

    );

  }



  private isLivenessFresh(): boolean {

    return (

      this.livenessPassed &&

      this.livenessVerifiedAt > 0 &&

      performance.now() - this.livenessVerifiedAt <= this.LIVENESS_MAX_AGE_MS

    );

  }



  private invalidateLiveness(message: string): void {

    // Once capture has started, later frames cannot change the submitted image.

    if (this.captureInProgress) {

      return;

    }



    this.livenessPassed = false;

    this.livenessVerifiedAt = 0;

    this.eyesWereOpen = false;

    this.eyesWereClosed = false;

    this.livenessMessage = message;

  }



  private resetLiveness(): void {

    this.livenessPassed = false;

    this.faceDetected = false;



    this.eyesWereOpen = false;

    this.eyesWereClosed = false;



    this.boundingBox = null;

    this.livenessVerifiedAt = 0;

    this.lastVideoTime = -1;

    this.captureInProgress = false;

  }



  private stopCameraProcessing(): void {

    if (this.animationFrameId !== null) {

      cancelAnimationFrame(

        this.animationFrameId

      );



      this.animationFrameId = null;

    }



    // Keep the shared model alive for the next dialog.
    this.faceLandmarker = null;



    if (this.videoStream) {

      this.videoStream

        .getTracks()

        .forEach(track => track.stop());



      this.videoStream = null;

    }



    if (this.videoElement?.nativeElement) {

      const video =

        this.videoElement.nativeElement;



      video.pause();

      video.srcObject = null;

    }

  }



  ngOnDestroy(): void {

    this.stopCameraProcessing();

  }



  onDateChange(event: any): void {

    this.editpatient.strDob =

      this.datePipe.transform(

        event,

        'MM-dd-yyyy'

      ) ?? '';

  }



  submitForm(): void {

    if (this.editpatient.name === '') {

      this.errorDisplay = true;

      this.errorMessage = 'Name is Required';

      return;

    }



    if (this.editpatient.nationalno === '') {

      this.errorDisplay = true;

      this.errorMessage = 'National is Required';

      return;

    }



    if (this.editpatient.mobileno === '') {

      this.errorDisplay = true;

      this.errorMessage = 'Mobile No is Required';

      return;

    }



    this.patientsService

      .updatePatient(this.editpatient)

      .subscribe({

        next: () => {

          if (!this.blob) {

            this.showSuccessfullyMessage = true;

            this.ref.close('Updated');

            return;

          }



          const formData = new FormData();

          formData.append(

            'file',

            this.blob,

            'captured-face.jpg'

          );



          this.patientsService

            .uploadFaceImage(

              formData,

              this.editpatient.id

            )

            .subscribe({

              next: uploadResponse => {

                console.log(

                  'Image uploaded successfully:',

                  uploadResponse

                );



                this.showSuccessfullyMessage = true;

                this.ref.close('Updated');

              },

              error: uploadError => {

                console.error(

                  'Image upload failed:',

                  uploadError

                );



                this.errorMessage =

                  'Failed to upload image';

                this.errorDisplay = true;

              }

            });

        },

        error: updateError => {

          console.error(

            'Patient update failed:',

            updateError

          );



          this.errorMessage =

            'Failed to update patient data';

          this.errorDisplay = true;

        }

      });

  }



}
