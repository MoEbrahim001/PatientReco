import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpenCameraComponent } from './open-camera.component';

describe('OpenCameraComponent', () => {
  let component: OpenCameraComponent;
  let fixture: ComponentFixture<OpenCameraComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [OpenCameraComponent]
    });
    fixture = TestBed.createComponent(OpenCameraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
