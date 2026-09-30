import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';import { Router } from '@angular/router'; // Import the Router to handle navigation
import { Camera } from '@mediapipe/camera_utils';
import { HttpClient } from '@angular/common/http';
import {
  FaceLandmarker,
  FilesetResolver,
  FaceLandmarkerResult
} from '@mediapipe/tasks-vision';
import { FaceDetection, Results } from '@mediapipe/face_detection'; 
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { detectAndFindres, ListPatients } from '../Models/patient';

@Component({
  selector: 'app-open-camera',
  templateUrl: './open-camera.component.html',
  styleUrls: ['./open-camera.component.css']
})

export class OpenCameraComponent implements AfterViewInit , OnDestroy {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  videoStream: MediaStream | null = null;
  private camera: Camera;
  patient:ListPatients

  blob:Blob;
  faceDetection: FaceDetection | null = null;
  boundingBox: { x: number; y: number; width: number; height: number } | null = null;
private faceLandmarker!: FaceLandmarker;

livenessPassed = false;
livenessMessage = 'Look at the camera and blink';

private eyesWereOpen = false;
private eyesWereClosed = false;

private lastVideoTime = -1;
private animationFrameId: number | null = null;
  constructor(private router: Router,private ref:DynamicDialogRef, private http:HttpClient) {} // Inject Router for navigation

  ngAfterViewInit(): void {

  navigator.mediaDevices
    .getUserMedia({
      video: true
    })
    .then(async (stream) => {

      console.log(
        'Camera stream started.'
      );

      this.videoStream = stream;

      const video =
        this.videoElement.nativeElement;

      video.srcObject = stream;

      await video.play();

      await this.initFaceLandmarker();

    })
    .catch((error) => {

      console.error(
        'Error accessing camera:',
        error
      );
    });
}
 async initFaceLandmarker(): Promise<void> {

  console.log('Initializing Face Landmarker...');

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );

  this.faceLandmarker =
    await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },

        runningMode: 'VIDEO',

        numFaces: 1,

        outputFaceBlendshapes: true,

        minFaceDetectionConfidence: 0.5,

        minFacePresenceConfidence: 0.5,

        minTrackingConfidence: 0.5
      }
    );

  console.log('Face Landmarker initialized.');

  this.processVideo();
}
  private processLiveness(
  result: FaceLandmarkerResult
): void {

  if (this.livenessPassed) {
    return;
  }

  if (
    !result.faceLandmarks ||
    result.faceLandmarks.length === 0
  ) {
    this.livenessMessage =
      'No face detected';

    this.eyesWereOpen = false;
    this.eyesWereClosed = false;

    return;
  }


  if (
    !result.faceBlendshapes ||
    result.faceBlendshapes.length === 0
  ) {
    return;
  }


  const categories =
    result.faceBlendshapes[0].categories;


  const leftBlink =
    categories.find(
      x => x.categoryName === 'eyeBlinkLeft'
    )?.score ?? 0;


  const rightBlink =
    categories.find(
      x => x.categoryName === 'eyeBlinkRight'
    )?.score ?? 0;


  console.log(
    'Blink:',
    leftBlink.toFixed(2),
    rightBlink.toFixed(2)
  );


  // العينين مفتوحين
  const eyesOpen =
    leftBlink < 0.25 &&
    rightBlink < 0.25;


  // العينين مقفولين
  const eyesClosed =
    leftBlink > 0.55 &&
    rightBlink > 0.55;


  if (
    eyesOpen &&
    !this.eyesWereClosed
  ) {

    this.eyesWereOpen = true;

    this.livenessMessage =
      'Blink your eyes';

    return;
  }


  if (
    this.eyesWereOpen &&
    eyesClosed
  ) {

    this.eyesWereClosed = true;

    this.livenessMessage =
      'Good... open your eyes';

    return;
  }


  // Open → Closed → Open
  // معناها Blink كاملة
  if (
    this.eyesWereOpen &&
    this.eyesWereClosed &&
    eyesOpen
  ) {

    console.log(
      'LIVENESS PASSED'
    );

    this.livenessPassed = true;

    this.livenessMessage =
      'Liveness passed ✓';
  }
}
 processVideo(): void {

  const video = this.videoElement.nativeElement;

  const process = () => {

    if (
      this.faceLandmarker &&
      video.readyState >= 2 &&
      video.currentTime !== this.lastVideoTime
    ) {

      this.lastVideoTime = video.currentTime;

      const result =
        this.faceLandmarker.detectForVideo(
          video,
          performance.now()
        );

      this.processLiveness(result);
    }

    this.animationFrameId =
      requestAnimationFrame(process);
  };

  process();
}

  drawFaceBoundaries(results: Results): void {
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx || !results.detections) {
      console.warn('No detections or canvas context.');
      return;
    }

    // Set canvas size to match video size
    canvas.width = this.videoElement.nativeElement.videoWidth;
    canvas.height = this.videoElement.nativeElement.videoHeight;

    // Clear the canvas and draw the video frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);

    this.boundingBox = null; // Reset bounding box

    // Draw bounding boxes for detected faces
    results.detections.forEach((detection) => {
      const boundingBox = detection.boundingBox;
      ctx.strokeStyle = '#00FF00'; // Green border for bounding box
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

 ngOnDestroy(): void {

  console.log(
    'Cleaning up resources...'
  );

  // Stop requestAnimationFrame
  if (this.animationFrameId !== null) {

    cancelAnimationFrame(
      this.animationFrameId
    );

    this.animationFrameId = null;
  }


  // Close Face Landmarker
  if (this.faceLandmarker) {

    this.faceLandmarker.close();
  }


  // Stop camera stream
  if (this.videoStream) {

    this.videoStream
      .getTracks()
      .forEach(
        track => track.stop()
      );

    this.videoStream = null;
  }


  // Stop video
  if (this.videoElement?.nativeElement) {

    const video =
      this.videoElement.nativeElement;

    video.pause();

    video.srcObject = null;
  }


  console.log(
    'Camera and FaceLandmarker cleaned up.'
  );
}
  

  // Method to stop the camera and navigate to the patients' page
  stopCameraAndRedirect(): void {
    // Stop the video stream to release the camera resources
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop()); // Stop all tracks (video)
      this.videoStream = null;
    }

    this.ref.close()

    // Close the camera popup (modal) or perform any other UI cleanup if needed
    console.log('Camera stopped and closing the popup.');

  }
  async captureAndDetectFace() {

  if (!this.livenessPassed) {
    alert('Please blink first.');
    return;
  }

  const video = this.videoElement.nativeElement;
  const canvas = this.canvasElement.nativeElement;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // مهم جدًا:
  // خد صورة CURRENT من الفيديو
  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  canvas.toBlob(async (blob) => {

    if (!blob) {
      return;
    }

    const formData = new FormData();

    formData.append(
      'file',
      blob,
      'face_image.png'
    );

    try {

      const response = await this.http
        .post<detectAndFindres>(
          'http://127.0.0.1:5000/detectAndFind',
          formData
        )
        .toPromise();

      console.log(
        'detect response:',
        response
      );

      if (
        response?.isMatch &&
        response.patientData
      ) {

        const patient: ListPatients = {
          ...response.patientData,
          name:
            response.patientName ??
            response.patientData.name,
          faceImgUrl:
            response.patientData.faceImgUrl
        };

        console.log(
          'mapped patient:',
          patient
        );

        this.ref.close(patient);

      } else {

        alert(
          'No matching patient found.'
        );
      }

    } catch (error) {

      console.error(
        'Error during face detection',
        error
      );
    }

  }, 'image/png');
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
    
  }
 

}
dataURLtoBlob(dataURL: string): Blob {
  const [mimeString, bstr] = dataURL.split(',');
  const mime = mimeString.match(/:(.*?);/)![1];
  const u8arr = Uint8Array.from(atob(bstr), (c) => c.charCodeAt(0));
  return new Blob([u8arr], { type: mime });
}
}