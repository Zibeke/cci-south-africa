import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { backendUrl } from './api';
import './styles.css';

const legacyStylesheet = document.createElement('link');
legacyStylesheet.rel = 'stylesheet';
legacyStylesheet.href = backendUrl('/original-site/style.css');
document.head.appendChild(legacyStylesheet);

ReactDOM.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById('root')
);