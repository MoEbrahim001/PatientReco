import {
  AfterViewInit,
  Component,
  ElementRef,
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

  constructor(
    private ref: DynamicDialogRef,
    private patientsService: PatientsService
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

        this.handleFaceResult(result, canvas);
      }

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
      this.resetBlink();
      this.livenessMessage = 'No face detected';
      return;
    }

    if (faces.length > 1) {
      this.resetBlink();
      this.livenessMessage = 'Keep only one face in the camera.';
      return;
    }

    const landmarks = faces[0];
    const xs = landmarks.map(point => point.x);
    const ys = landmarks.map(point => point.y);

    const minX = Math.max(0, Math.min(...xs));
    const maxX = Math.min(1, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxY = Math.min(1, Math.max(...ys));

    ctx.strokeStyle = this.livenessPassed
      ? '#16a34a'
      : '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(
      minX * canvas.width,
      minY * canvas.height,
      (maxX - minX) * canvas.width,
      (maxY - minY) * canvas.height
    );

    this.processLiveness(result);
  }

  private processLiveness(
    result: FaceLandmarkerResult
  ): void {
    if (this.livenessPassed) {
      this.livenessMessage = 'Liveness passed ✓';
      return;
    }

    const blendshapes = result.faceBlendshapes;

    if (!blendshapes || blendshapes.length !== 1) {
      this.livenessMessage = 'Keep looking at the camera.';
      return;
    }

    const categories = blendshapes[0].categories;

    const leftBlink =
      categories.find(
        x => x.categoryName === 'eyeBlinkLeft'
      )?.score ?? 0;

    const rightBlink =
      categories.find(
        x => x.categoryName === 'eyeBlinkRight'
      )?.score ?? 0;

    const eyesOpen =
      leftBlink < 0.25 && rightBlink < 0.25;

    const eyesClosed =
      leftBlink > 0.55 && rightBlink > 0.55;

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
      this.livenessMessage = 'Liveness passed ✓';
    }
  }

  async captureAndDetectFace(): Promise<void> {
    if (!this.livenessPassed) {
      this.livenessMessage = 'Please complete the blink check first.';
      return;
    }

    const video = this.videoElement.nativeElement;
    const captureCanvas = document.createElement('canvas');
    const ctx = captureCanvas.getContext('2d');

    if (!ctx) {
      return;
    }

    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;

    ctx.drawImage(
      video,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height
    );

    captureCanvas.toBlob(blob => {
      if (!blob) {
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'face_image.png');

      // Angular -> .NET only.
      // .NET forwards the image to Python.
      this.patientsService
        .detectAndFind(formData)
        .subscribe({
          next: (response: detectAndFindres) => {
            if (response?.isMatch && response.patientData) {
              const patient: ListPatients = {
                ...response.patientData,
                name:
                  response.patientName ??
                  response.patientData.name,
                faceImgUrl:
                  response.patientData.faceImgUrl
              };

              this.ref.close(patient);
              return;
            }

            alert('No matching patient found.');
          },
          error: error => {
            console.error(
              'Error during face detection:',
              error
            );
            alert('Face recognition request failed.');
          }
        });
    }, 'image/png');
  }

  stopCameraAndRedirect(): void {
    this.cleanupCamera();
    this.ref.close();
  }

  ngOnDestroy(): void {
    this.cleanupCamera();
  }

  private resetBlink(): void {
    if (this.livenessPassed) {
      return;
    }

    this.eyesWereOpen = false;
    this.eyesWereClosed = false;
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
