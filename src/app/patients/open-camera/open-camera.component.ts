import { Component, ElementRef, OnDestroy, OnInit, ViewChild  } from '@angular/core';
import { Router } from '@angular/router'; // Import the Router to handle navigation
import { Camera } from '@mediapipe/camera_utils';

import { FaceDetection, Results } from '@mediapipe/face_detection'; 
import { DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-open-camera',
  templateUrl: './open-camera.component.html',
  styleUrls: ['./open-camera.component.css']
})

export class OpenCameraComponent implements OnInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  videoStream: MediaStream | null = null;
  private camera: Camera;

  blob:Blob;
  faceDetection: FaceDetection | null = null;
  boundingBox: { x: number; y: number; width: number; height: number } | null = null;

  constructor(private router: Router,private ref:DynamicDialogRef) {} // Inject Router for navigation

  ngOnInit(): void {

    // Accessing the camera stream and initializing video element
    navigator.mediaDevices.getUserMedia({
      video: true
    }).then((stream) => {
      this.videoStream = stream;
      this.videoElement.nativeElement.srcObject = stream;
      this.videoElement.nativeElement.play();
      this.initFaceDetection();
    }).catch((error) => {
      console.error('Error accessing camera:', error);
    });
  }

  initFaceDetection(): void {
    // Initialize face detection using Mediapipe
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

  processVideo(): void {
    const video = this.videoElement.nativeElement;
    let frameCount = 0;

    // Request next frame for processing
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

  drawFaceBoundaries(results: Results): void {
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx || !results.detections) {
      return;
    }

    // Set canvas size to match video size
    canvas.width = this.videoElement.nativeElement.videoWidth;
    canvas.height = this.videoElement.nativeElement.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);

    this.boundingBox = null; // Reset bounding box

    // Draw bounding box for each detected face
    results.detections.forEach((detection) => {
      const boundingBox = detection.boundingBox;
      ctx.strokeStyle = '#00FF00'; // Set border color
      ctx.lineWidth = 3; // Set line width for bounding box
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
