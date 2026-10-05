import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild
} from '@angular/core';
import {
  FaceLandmarker,
  FaceLandmarkerResult,
  FilesetResolver
} from '@mediapipe/tasks-vision';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { detectAndFindres, ListPatients } from '../Models/patient';
import { PatientsService } from '../patients.service';

@Component({
  selector: 'app-open-camera',
  templateUrl: './open-camera.component.html',
  styleUrls: ['./open-camera.component.css']
})
export class OpenCameraComponent
  implements AfterViewInit, OnDestroy {

  @ViewChild('videoElement', { static: false })
  videoElement!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvasElement', { static: false })
  canvasElement!: ElementRef<HTMLCanvasElement>;

  videoStream: MediaStream | null = null;

  livenessPassed = false;
  livenessMessage = 'Look at the camera and blink';

  private faceLandmarker: FaceLandmarker | null = null;
  private animationFrameId: number | null = null;
  private lastVideoTime = -1;
  private eyesWereOpen = false;
  private eyesWereClosed = false;

  private faceDetected = false;
  private boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;

  private livenessVerifiedAt = 0;
  private readonly LIVENESS_MAX_AGE_MS = 1200;
  private recognitionInProgress = false;

constructor(
  private ref: DynamicDialogRef,
  private patientsService: PatientsService,
  private ngZone: NgZone,
  private cdr: ChangeDetectorRef
) {}

  async ngAfterViewInit(): Promise<void> {
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
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.livenessMessage = 'Unable to access the camera.';
    }
  }

  private async initFaceLandmarker(): Promise<void> {
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
    const canvas = this.canvasElement.nativeElement;

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

this.ngZone.run(() => {
  this.handleFaceResult(result, canvas);
  this.cdr.detectChanges();
});      }

      if (this.videoStream) {
        this.animationFrameId = requestAnimationFrame(process);
      }
    };

    process();
  }

  private handleFaceResult(
    result: FaceLandmarkerResult,
    canvas: HTMLCanvasElement
  ): void {
    const video = this.videoElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const faces = result.faceLandmarks ?? [];

    if (faces.length === 0) {
      this.faceDetected = false;
      this.boundingBox = null;
      this.invalidateLiveness('No face detected');
      return;
    }

    if (faces.length > 1) {
      this.faceDetected = false;
      this.boundingBox = null;
      this.invalidateLiveness('Keep only one face in the camera.');
      return;
    }

    const box = this.getFaceBoundingBox(
      faces[0],
      canvas.width,
      canvas.height
    );

    if (!box) {
      this.faceDetected = false;
      this.boundingBox = null;
      this.invalidateLiveness('Move closer and keep your full face centered.');
      return;
    }

    this.faceDetected = true;
    this.boundingBox = box;

    ctx.strokeStyle = this.livenessPassed ? '#16a34a' : '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    this.processLiveness(result);
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

    if (normalizedWidth < 0.16 || normalizedHeight < 0.20) {
      return null;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    if (
      centerX < 0.15 || centerX > 0.85 ||
      centerY < 0.12 || centerY > 0.88
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

  private processLiveness(
    result: FaceLandmarkerResult
  ): void {
    if (this.livenessPassed) {
      if (!this.isLivenessFresh() && !this.recognitionInProgress) {
        this.invalidateLiveness('Verification expired. Blink again.');
        return;
      }

      this.livenessMessage = this.recognitionInProgress
        ? 'Verified. Recognizing patient...'
        : 'Liveness passed ✓';
      return;
    }

    const blendshapes = result.faceBlendshapes;

    if (!blendshapes || blendshapes.length !== 1) {
      this.livenessMessage = 'Keep looking at the camera.';
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
        this.livenessMessage = 'Blink your eyes';
      }
      return;
    }

    if (!this.eyesWereClosed && eyesClosed) {
      this.eyesWereClosed = true;
      this.livenessMessage = 'Good... open your eyes';
      return;
    }

    if (this.eyesWereClosed && eyesOpen) {
      this.livenessPassed = true;
      this.livenessVerifiedAt = performance.now();
      this.livenessMessage = 'Verified. Capturing this same live face now...';

      // Auto-recognize immediately from the verified live stream.
      queueMicrotask(() => {
        void this.captureAndDetectFace();
      });
    }
  }

  async captureAndDetectFace(): Promise<void> {
    if (this.recognitionInProgress) {
      return;
    }

    if (
      !this.livenessPassed ||
      !this.isLivenessFresh() ||
      !this.faceDetected ||
      !this.boundingBox
    ) {
      this.invalidateLiveness('Live verification is required. Blink again.');
      return;
    }

    this.recognitionInProgress = true;
    this.livenessMessage = 'Verified. Recognizing patient...';

    const video = this.videoElement.nativeElement;
    const captureCanvas = document.createElement('canvas');
    const ctx = captureCanvas.getContext('2d');

    if (!ctx) {
      this.recognitionInProgress = false;
      return;
    }

    const { x, y, width, height } = this.boundingBox;
    const sourceX = Math.max(0, Math.floor(x));
    const sourceY = Math.max(0, Math.floor(y));
    const sourceWidth = Math.min(video.videoWidth - sourceX, Math.floor(width));
    const sourceHeight = Math.min(video.videoHeight - sourceY, Math.floor(height));

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      this.recognitionInProgress = false;
      this.invalidateLiveness('Unable to capture a valid face. Blink again.');
      return;
    }

    captureCanvas.width = sourceWidth;
    captureCanvas.height = sourceHeight;

    ctx.drawImage(
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

    captureCanvas.toBlob(blob => {
      if (!blob) {
        this.recognitionInProgress = false;
        this.invalidateLiveness('Could not capture the face. Blink again.');
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'face_image.jpg');

      this.patientsService
        .detectAndFind(formData)
        .subscribe({
          next: (response: detectAndFindres) => {
  this.ngZone.run(() => {
    this.recognitionInProgress = false;

    if (response?.isMatch && response.patientData) {
      const patient: ListPatients = {
        ...response.patientData,
        name:
          response.patientName ??
          response.patientData.name,
        faceImgUrl:
          response.patientData.faceImgUrl
      };

      this.cleanupCamera();
      this.ref.close(patient);

      this.cdr.detectChanges();
      return;
    }

    this.invalidateLiveness(
      'No match found. Blink again to retry.'
    );

    this.cdr.detectChanges();
    alert('No matching patient found.');
  });
},
          error: error => {
            this.recognitionInProgress = false;
            console.error('Error during face detection:', error);
            this.invalidateLiveness('Recognition failed. Blink again to retry.');
            alert('Face recognition request failed.');
          }
        });
    }, 'image/jpeg', 0.88);
  }

  stopCameraAndRedirect(): void {
    this.cleanupCamera();
    this.ref.close();
  }

  ngOnDestroy(): void {
    this.cleanupCamera();
  }

  private isLivenessFresh(): boolean {
    return (
      this.livenessPassed &&
      this.livenessVerifiedAt > 0 &&
      performance.now() - this.livenessVerifiedAt <= this.LIVENESS_MAX_AGE_MS
    );
  }

  private invalidateLiveness(message: string): void {
    // If a verified frame has already been captured and sent,
    // later changes in the camera cannot alter that request.
    if (this.recognitionInProgress) {
      return;
    }

    this.livenessPassed = false;
    this.livenessVerifiedAt = 0;
    this.eyesWereOpen = false;
    this.eyesWereClosed = false;
    this.livenessMessage = message;
  }

  private cleanupCamera(): void {
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
}
