import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreatePatient,
  detectAndFindres,
  Editpatient,
  ListPatients,
  PatientResult
} from './Models/patient';
import { environment } from 'src/environments/environment';
import { PatientParams } from './Models/PatientParams';

@Injectable({
  providedIn: 'root'
})
export class PatientsService {

  private readonly patientsApiUrl =
    `${environment.apiUrl}/Patients`;

  private readonly httpHeader = {
    headers: new HttpHeaders({
      'content-type': 'application/json',
      'Accept': '*/*'
    })
  };

  constructor(private httpClient: HttpClient) {}

  getPatients(
    patientParams: PatientParams
  ): Observable<PatientResult> {
    return this.httpClient.post<PatientResult>(
      this.patientsApiUrl,
      patientParams,
      this.httpHeader
    );
  }

  addPatient(
    patientData: CreatePatient
  ): Observable<number> {
    return this.httpClient.post<number>(
      `${this.patientsApiUrl}/addPatient`,
      patientData,
      this.httpHeader
    );
  }

  searchPatients(
    searchText: string
  ): Observable<ListPatients[]> {
    return this.httpClient.get<ListPatients[]>(
      `${this.patientsApiUrl}/search?searchText=${encodeURIComponent(searchText)}`
    );
  }

  getPatientById(
    id: number
  ): Observable<Editpatient> {
    return this.httpClient.get<Editpatient>(
      `${this.patientsApiUrl}/${id}`,
      this.httpHeader
    );
  }

  updatePatient(
    patient: Editpatient
  ): Observable<any> {
    return this.httpClient.put(
      `${this.patientsApiUrl}/UpdatePatient`,
      patient,
      this.httpHeader
    );
  }

  deleteAllPatients(): Observable<any> {
    return this.httpClient.delete(
      `${this.patientsApiUrl}/deleteAll`,
      this.httpHeader
    );
  }

  deletePatient(
    patientId: number
  ): Observable<any> {
    return this.httpClient.delete(
      `${this.patientsApiUrl}/${patientId}`,
      this.httpHeader
    );
  }

  uploadFaceImage(
    formData: FormData,
    patientId: number
  ): Observable<any> {
    return this.httpClient.post(
      `${this.patientsApiUrl}/uploadFaceImage/${patientId}`,
      formData
    );
  }

  detectAndFind(
    formData: FormData
  ): Observable<detectAndFindres> {
    return this.httpClient.post<detectAndFindres>(
      `${this.patientsApiUrl}/detectAndFind`,
      formData
    );
  }
}
