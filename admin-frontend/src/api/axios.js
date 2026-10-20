import axios from 'axios';
import { getApiBaseUrl } from '../utils/backendUrl';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true
});

export default api;
