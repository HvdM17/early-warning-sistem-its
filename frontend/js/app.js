import { initNavigation } from './navigation.js';
import { initStudentControls } from './students.js';
import { initPrediction } from './prediction.js';
import { loadBackendData } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initStudentControls();
  initPrediction();
  loadBackendData();
});
