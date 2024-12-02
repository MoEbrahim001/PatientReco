import { Component, ViewChild, ElementRef } from '@angular/core';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-patient-registration',
  templateUrl: './patient-registration.component.html',
  styleUrls: ['./patient-registration.component.css']
})
export class PatientRegistrationComponent {
  @ViewChild('videoElement') videoElement!: ElementRef;
  @ViewChild('canvasElement') canvasElement!: ElementRef;
  patientName: string = '';
  faceDetection!: FaceDetection;
  camera!: Camera;

  constructor(private http: HttpClient) {}

  async openCamera() {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement.getContext('2d');
  
    this.faceDetection = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });
    this.faceDetection.setOptions({ model: 'short' });
  
    this.camera = new Camera(video, {
      onFrame: async () => {
        await this.faceDetection.send({ image: video });
      },
      width: 640,
      height: 480,
    });
    this.camera.start();
  
    this.faceDetection.onResults((results) => {
      canvas.clearRect(0, 0, video.width, video.height);
      if (results.detections.length > 0) {
        results.detections.forEach((detection) => {
          const boundingBox = detection.boundingBox;
          canvas.strokeRect(
            boundingBox.xCenter - boundingBox.width / 2,
            boundingBox.yCenter - boundingBox.height / 2,
            boundingBox.width,
            boundingBox.height
          );
        });
      }
    });
  }

  async captureAndSave() {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement.getContext('2d');
    canvas.drawImage(video, 0, 0, video.width, video.height);

    // Convert the captured image to Blob for upload
    canvas.toBlob(async (blob: Blob | null) => {
      if (blob) {
        const formData = new FormData();
        formData.append('file', blob, `${this.patientName}.jpg`);
        formData.append('patientName', this.patientName);

        // Send the captured image and patient data to the backend
        try {
          const response = await this.http.post('/api/save', formData).toPromise();
          console.log('Save successful', response);
        } catch (error) {
          console.error('Save failed', error);
        }
      }
    }, 'image/jpeg');
  }
}
