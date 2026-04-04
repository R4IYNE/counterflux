import './styles/main.css';
import './styles/utilities.css';
import 'mana-font/css/mana.min.css';
import 'keyrune/css/keyrune.min.css';
import 'material-symbols/outlined.css';

import Alpine from 'alpinejs';
import { initAppStore } from './stores/app.js';
import { initRouter } from './router.js';

// Initialize stores before Alpine starts
initAppStore();

// Start Alpine
Alpine.start();

// Initialize router after Alpine is ready
initRouter();

console.log('Counterflux -- The Aetheric Archive');
