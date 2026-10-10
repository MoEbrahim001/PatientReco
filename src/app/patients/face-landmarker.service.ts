import { Injectable } from '@angular/core';
import {
  FaceLandmarker,
  FilesetResolver
} from '@mediapipe/tasks-vision';

@Injectable({
  providedIn: 'root'
})
export class FaceLandmarkerService {

  private faceLandmarker: FaceLandmarker | null = null;
  private loadingPromise: Promise<FaceLandmarker> | null = null;

  async preload(): Promise<void> {
    const startedAt = performance.now();

    try {
      await this.getFaceLandmarker();

      console.log(
        `[PERF][ANGULAR] FaceLandmarker preload = ` +
        `${(performance.now() - startedAt).toFixed(0)} ms`
      );
    } catch (error) {
      console.error(
        '[PERF][ANGULAR] FaceLandmarker preload FAILED',
        error
      );
    }
  }

  async getFaceLandmarker(): Promise<FaceLandmarker> {

    if (this.faceLandmarker) {
      return this.faceLandmarker;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.createFaceLandmarker();
    }

    try {
      this.faceLandmarker = await this.loadingPromise;
      return this.faceLandmarker;
    } catch (error) {
      // Allow a future retry if CDN/model loading failed.
      this.loadingPromise = null;
      throw error;
    }
  }

  private async createFaceLandmarker(): Promise<FaceLandmarker> {

    const startedAt = performance.now();

    console.log(
      '[PERF][ANGULAR] FaceLandmarker initialization START'
    );

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );

    const faceLandmarker =
      await FaceLandmarker.createFromOptions(
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

    console.log(
      `[PERF][ANGULAR] FaceLandmarker initialization END = ` +
      `${(performance.now() - startedAt).toFixed(0)} ms`
    );

    return faceLandmarker;
  }
}
