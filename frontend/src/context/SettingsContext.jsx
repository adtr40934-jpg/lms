import { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../api';

export const SettingsContext = createContext({
  settings: {},
  loadingSettings: true,
  refreshSettings: () => {}
});

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({});
  const [loadingSettings, setLoadingSettings] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      const data = res.settings || {};
      setSettings(data);
      if (data.site_name) {
        localStorage.setItem('site_name', data.site_name);
        if (!document.title || document.title.includes('منصة التعلم الإلكتروني')) {
          document.title = data.site_name;
        }
        const loaderTextEl = document.getElementById('loader-text-el');
        if (loaderTextEl) loaderTextEl.textContent = data.site_name;
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loadingSettings, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
