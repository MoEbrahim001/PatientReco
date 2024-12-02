import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreatePatient, Editpatient, ListPatients, viewPatient } from './Models/patient';  // Adjust based on where ListPatients is defined
import { environment } from 'src/environments/environment';  // Import environment

@Injectable({
  providedIn: 'root'
})
export class PatientsService {
  private apiUrl = 'https://localhost:7266/api/Patients'; // Update with your API URL

  httpHeader = {
    headers: new HttpHeaders({
      'content-type': 'application/json',
      'Accept': '*/*'

    })
  };


  constructor(private httpClient: HttpClient , private http: HttpClient) {}

  // Example method to get the list of patients using the API URL from the environment
  getPatients(): Observable<ListPatients[]> {
    return this.httpClient.get<ListPatients[]>(`${environment.listPatients}`, this.httpHeader);
  }
  // getPatients(): Observable<ListPatients[]> {
  //   return this.http.get<ListPatients[]>(`${this.apiUrl}/api/Patients`);
  // }

  // Example method to add a patient
  addPatient(patientData: CreatePatient): Observable<any> {
    return this.httpClient.post(`${environment.apiUrl}/addPatient`, patientData, this.httpHeader);
  }
  
   // New method for searching patients
  //  searchPatients(searchText: string): Observable<ListPatients[]> {
  //   return this.httpClient.get<ListPatients[]>(`${environment.apiUrl}/Patients/search?searchText=${searchText}`, this.httpHeader);
  // }
  searchPatients(searchText: string): Observable<ListPatients[]> {
    return this.httpClient.get<ListPatients[]>(`${environment.apiUrl}/Patients/search?searchText=${searchText}`, this.httpHeader);
  }
  getPatientById(id: number): Observable<Editpatient> {
    return this.httpClient.get<Editpatient>(`${environment.apiUrl}/Patients/${id}`, this.httpHeader);
  }
  
  
  updatePatient(patient: Editpatient): Observable<any> {
    return this.httpClient.put(`${environment.apiUrl}/Patients/UpdatePatient`, patient,  this.httpHeader);
}

  
  deleteAllPatients(): Observable<any> {
    return this.httpClient.delete(`${environment.apiUrl}/Patients/deleteAll`, this.httpHeader);
  }
  deletePatient(patientId: number): Observable<any> {
    return this.httpClient.delete(`${environment.apiUrl}/Patients/${patientId}`, this.httpHeader);
  }
  savePatientImage(formData: FormData): Observable<void> {
    return this.httpClient.post<void>(`${environment.apiUrl}/patients/save`, formData);
  }

  uploadFaceImage(formData: FormData, patientId:number): Observable<any> {
    return this.httpClient.post(`${this.apiUrl}/uploadFaceImage/${patientId}`, formData);
  }
  
  

}
  
  

