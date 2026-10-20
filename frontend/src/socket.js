import { io } from 'socket.io-client';
import { getBackendOrigin } from './utils/backendUrl';

export function getDeviceId() {
  try {
    let id = localStorage.getItem('lms_device_id');
    if (!id) {
      id = 'dev_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36)));
      localStorage.setItem('lms_device_id', id);
    }
    return id;
  } catch (e) {
    return 'temp_' + Math.random().toString(36).substring(2, 12);
  }
}

const socket = io(getBackendOrigin(), {
  withCredentials: true,
  auth: {
    deviceId: getDeviceId()
  }
});

export default socket;
