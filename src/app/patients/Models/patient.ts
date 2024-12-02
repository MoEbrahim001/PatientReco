// src/app/models/patient.ts

export class ListPatients {
    id: number;
    name: string; // Use camelCase for consistency
    dob: Date;
    mobileno: string;
    nationalno: string;
     faceImg: string; // Add the faceImg property


}
export class viewPatient {
    id: number;
    name: string; // Use camelCase for consistency
    dob: Date;
    mobileno: string;
    nationalno: string;
     faceImg: string; // Add the faceImg property


}
export class Editpatient
{
    id: number;
    name: string; // Use camelCase for consistency
    dob: Date;
    strDob:string;
    dobdate: Date;
    mobileno: string;
    nationalno: string;
     faceImg: string; // Add the faceImg property
}
export class CreatePatient {
    id: number;
    name: string; // Use camelCase for consistency
    mobileno: string;
    nationalno: string;
    dob:string;
    faceImg: string;
}