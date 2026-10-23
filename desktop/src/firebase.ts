import { getApp, getApps, initializeApp } from 'firebase/app';
import publicConfig from './firebase.config.json';
const env=import.meta.env;
const projectId=env.VITE_FIREBASE_PROJECT_ID||publicConfig.projectId;
export const firebaseConfig={
 apiKey:env.VITE_FIREBASE_API_KEY||publicConfig.apiKey,
 authDomain:env.VITE_FIREBASE_AUTH_DOMAIN||publicConfig.authDomain,
 projectId,
 appId:env.VITE_FIREBASE_APP_ID||publicConfig.appId,
 measurementId:env.VITE_FIREBASE_MEASUREMENT_ID||(projectId===publicConfig.projectId?publicConfig.measurementId:''),
};
export function firebaseApp(){return getApps().length?getApp():initializeApp(firebaseConfig);}
