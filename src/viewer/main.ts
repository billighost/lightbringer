import { ModelViewerApp } from './modelViewer';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('viewer-container');
  if (container) {
    new ModelViewerApp(container);
  }
});
