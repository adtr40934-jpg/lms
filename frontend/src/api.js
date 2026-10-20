import axiosInstance from './api/axios';

async function request(method, path, body, isFormData = false, onUploadProgress = null) {
  const headers = {};
  // Do NOT set 'Content-Type': 'multipart/form-data' manually when body is FormData;
  // letting Axios / browser set it ensures the multipart boundary is correctly included.

  try {
    const res = await axiosInstance({
      method,
      url: path,
      data: body,
      headers,
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted, progressEvent.loaded, progressEvent.total);
        }
      }
    });
    return res.data;
  } catch (err) {
    if (err.response && err.response.data) {
      const errorObj = new Error(err.response.data.message || 'حدث خطأ في الخادم');
      Object.assign(errorObj, err.response.data);
      throw errorObj;
    }
    throw new Error('حدث خطأ في الاتصال بالخادم');
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, isForm, onProgress) => request('POST', path, body, isForm, onProgress),
  put: (path, body, isForm, onProgress) => request('PUT', path, body, isForm, onProgress),
  patch: (path, body, isForm, onProgress) => request('PATCH', path, body, isForm, onProgress),
  delete: (path) => request('DELETE', path),
};

export default api;
