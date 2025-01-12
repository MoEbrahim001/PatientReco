import { Component, ElementRef, OnDestroy, OnInit, ViewChild  } from '@angular/core';
import { Router } from '@angular/router'; // Import the Router to handle navigation
import { Camera } from '@mediapipe/camera_utils';
import { HttpClient } from '@angular/common/http';
import { FaceDetection, Results } from '@mediapipe/face_detection'; 
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { detectAndFindres, ListPatients } from '../Models/patient';

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
  patient:ListPatients

  blob:Blob;
  faceDetection: FaceDetection | null = null;
  boundingBox: { x: number; y: number; width: number; height: number } | null = null;

  constructor(private router: Router,private ref:DynamicDialogRef, private http:HttpClient) {} // Inject Router for navigation

  ngOnInit(): void {
    // Access the camera stream and initialize the video element
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        console.log('Camera stream started.');
        this.videoStream = stream;
        this.videoElement.nativeElement.srcObject = stream;
        this.videoElement.nativeElement.play();

        // Delay initialization of face detection to ensure resources are ready
        setTimeout(() => {
          this.initFaceDetection();
        }, 500);
      })
      .catch((error) => {
        console.error('Error accessing camera:', error);
      });
  }
  initFaceDetection(): void {
    // Prevent reinitialization of face detection
    if (this.faceDetection) {
      console.warn('FaceDetection is already initialized.');
      return;
    }

    console.log('Initializing FaceDetection...');
    this.faceDetection = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });

    this.faceDetection.setOptions({
      model: 'short', // Use the short-range model
      minDetectionConfidence: 0.5,
    });

    this.faceDetection.onResults((results: any) => {
     
      this.drawFaceBoundaries(results);
    });

    console.log('FaceDetection initialized.');
    this.processVideo();
  }
  
  processVideo(): void {
    const video = this.videoElement.nativeElement;

    // Check if video element is ready
    if (!video || !video.readyState) {
      console.warn('Video element is not ready yet.');
      return;
    }

    let frameCount = 0;

    const process = async () => {
      if (this.faceDetection) {
        try {
          // Send every 10th frame for face detection
          if (frameCount % 10 === 0) {
            await this.faceDetection.send({ image: video });
          }
          frameCount++;
        } catch (error) {
          console.error('Error in face detection:', error);
        }
      }

      // Add a slight delay for better performance
      setTimeout(() => requestAnimationFrame(process), 10);
    };

    // Start the processing loop
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
    console.log('Cleaning up resources...');
    // Stop the video stream
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      console.log('Camera stream stopped.');
    }

    // Clean up the face detection object
    if (this.faceDetection) {
      this.faceDetection.reset(); // Reset resources
      this.faceDetection.close(); // Properly close the Mediapipe object
      this.faceDetection = null;  // Prevent further access
      console.log('FaceDetection cleaned up.');
    }

    // Stop the video element
    const video = this.videoElement.nativeElement;
    video.pause();
    video.srcObject = null;
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
    const canvas = this.canvasElement.nativeElement;
    canvas.toBlob(async (blob) => {
      if (blob) {
        const formData = new FormData();
        formData.append('file', blob, 'face_image.png');
    
        // Make API call to send captured image
        try {
          const response = await this.http.post<detectAndFindres>('http://127.0.0.1:5000/detectAndFind', formData).toPromise();
          console.log(response);
           this.patient = response.patientData
           this.patient.name=response.patientName
           
          if (response['isMatch']) {
            this.ref.close(this.patient)
            // const patientData = response['patientData'];  // Extract patient data from response
            // const patientDetails = `
            //   Patient Found: ${response['patientName']}\n
            //   Dob: ${patientData['Dob']}\n
            //   Mobile No: ${patientData['Mobileno']}\n
            //   Patient ID: ${patientData['PatientId']}\n
            //   National No: ${patientData['NationalNo']}\n
            //   Face Image: ${patientData['FaceImg']}
            // `;
            // alert(patientDetails);  // Display full patient information
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