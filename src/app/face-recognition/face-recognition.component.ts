// face-recognition.component.ts
import { Component, OnInit } from '@angular/core';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';

@Component({
  selector: 'app-face-recognition',
  templateUrl: './face-recognition.component.html',
  styleUrls: ['./face-recognition.component.css']
})
export class FaceRecognitionComponent implements OnInit {
  private videoElement: HTMLVideoElement;
  private faceDetection: FaceDetection;

  constructor() {}

  ngOnInit(): void {
    this.videoElement = document.getElementById('video') as HTMLVideoElement;
    this.initFaceDetection();
  }

  private initFaceDetection(): void {
    this.faceDetection = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/gh/google/mediapipe/${file}`
    });
  
    this.faceDetection.setOptions({
      minDetectionConfidence: 0.5 // Adjust detection confidence as necessary
    });
  
    const camera = new Camera(this.videoElement, {
      onFrame: async () => {
        await this.faceDetection.send({ image: this.videoElement });
      },
      width: 640,
      height: 480
    });
    camera.start();
  
    this.faceDetection.onResults(this.onFaceDetectionResults.bind(this));
  }
  

  private onFaceDetectionResults(results: any): void {
    // Process results and draw bounding boxes
    if (results.detections.length > 0) {
      // Logic to draw bounding box on the video feed
    }
  }

  // Method to capture image and save it
  captureImage(name: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0);
    const faceImg = canvas.toDataURL('image/jpeg');
    
    // Send faceImg and name to the API to save it
    this.saveFaceImage(faceImg, name);
  }

  private saveFaceImage(faceImg: string, name: string): void {
    // Convert base64 to Blob and send to API
    const blob = this.dataURLtoBlob(faceImg);
    const formData = new FormData();
    formData.append('file', blob, `${name}.jpg`);
    
    // Call your API to save the image here
  }

  private dataURLtoBlob(dataURL: string): Blob {
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeString });
  }
}
