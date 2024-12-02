import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientsComponent } from './patients/patients.component';
import { AddPatientComponent } from './patients/add-patient/add-patient.component';
import { EditPatientComponent } from './patients/edit-patient/edit-patient.component';




const routes: Routes = [
  { path: '', component: PatientsComponent },
  { path: 'patients/add', component: AddPatientComponent },
  { path: 'edit-patient/:id', component: EditPatientComponent },
 ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
