import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import * as tus from 'tus-js-client';
import { io } from 'socket.io-client';
import { getBackendOrigin, getApiBaseUrl } from '../../utils/backendUrl';
import { getAssetUrl } from '../../utils/assetUrl';

function CourseContent() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('id');

  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms & selection states
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [parentSection, setParentSection] = useState(null);

  const [editingLesson, setEditingLesson] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [assets, setAssets] = useState([]);

  // Upload Progress State (Inline)
  const [uploadState, setUploadState] = useState({ isUploading: false, progress: 0, loaded: 0, total: 0, isPaused: false, isRetrying: false, isResumable: false, errorMsg: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [pendingReorders, setPendingReorders] = useState({});
  const activeTusUploadRef = useRef(null);
  const activeXhrRef = useRef(null);
  const currentPreparingVideoIdRef = useRef(null);
  const isCancelledRef = useRef(false);
  const cancelPromiseRejectRef = useRef(null);

  // Post-upload Bunny processing phase (Uploading → Transcoding on Bunny side)
  const [bunnyProcessing, setBunnyProcessing] = useState(false);

  // Bunny Stream Status & Transcoding State
  const [bunnyStatus, setBunnyStatus] = useState({ status: 4, statusText: 'جاهز للعرض', encodeProgress: 100, isReady: true });

  // Course Duration Modal State
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [modalDurationInput, setModalDurationInput] = useState('');
  const [modalIsManual, setModalIsManual] = useState(false);
  const [durationUpdating, setDurationUpdating] = useState(false);

  useEffect(() => {
    fetchContent();
  }, [courseId]);

  // Prevent page reload during upload or when form is dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (uploadState.isUploading || isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploadState.isUploading, isDirty]);

  // Auto-resume TUS upload when internet comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (activeTusUploadRef.current && uploadState.isUploading) {
        console.log('Internet restored, resuming upload automatically...');
        setUploadState(prev => ({ ...prev, isRetrying: false, isPaused: false, errorMsg: '' }));
        try {
          activeTusUploadRef.current.start();
        } catch (e) {
          console.error('Error resuming tus on online:', e);
        }
      }
    };

    const handleOffline = () => {
      if (activeTusUploadRef.current && uploadState.isUploading) {
        console.warn('Internet lost during upload');
        setUploadState(prev => ({
          ...prev,
          isRetrying: true,
          errorMsg: 'انقطع اتصال الإنترنت، لا تقلق! سيستأنف الرفع تلقائياً من حيث توقف فور عودة النت.'
        }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [uploadState.isUploading]);

  // Poll Bunny Stream video status for active lesson
  useEffect(() => {
    let timer = null;
    const videoId = editingLesson?.bunny_video_id;

    if (!videoId) {
      setBunnyStatus({ status: 4, statusText: 'جاهز للعرض', encodeProgress: 100, isReady: true });
      setBunnyProcessing(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await api.get(`/courses/admin/lessons/bunny-status/${videoId}`);
        setBunnyStatus(res || { status: 4, statusText: 'جاهز للعرض', encodeProgress: 100, isReady: true });

        if (res && res.length > 0) {
          const totalSeconds = Math.round(res.length);
          const h = Math.floor(totalSeconds / 3600);
          const m = Math.floor((totalSeconds % 3600) / 60);
          const s = totalSeconds % 60;
          const fmt = h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            : `${m}:${s.toString().padStart(2, '0')}`;
          const durInput = document.querySelector('input[name="duration"]');
          if (durInput && (!durInput.value || durInput.value === '00:00')) {
            durInput.value = fmt;
            setIsDirty(true);
          }
        }

        if (res && !res.isReady && res.status !== 5) {
          // Still processing on Bunny side
          setBunnyProcessing(true);
          timer = setTimeout(checkStatus, 3000);
        } else {
          // Done or error
          setBunnyProcessing(false);
          // Silent background update: video is ready, refresh content so preview and duration update live
          fetchContent(editingLesson?._id, true);
        }
      } catch (err) {
        setBunnyStatus({ status: 4, statusText: 'جاهز للعرض', encodeProgress: 100, isReady: true });
        setBunnyProcessing(false);
      }
    };

    checkStatus();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [editingLesson?.bunny_video_id]);

  // Socket.IO for real-time background sync without page reloads
  useEffect(() => {
    const socket = io(getBackendOrigin(), {
      withCredentials: true
    });

    socket.on('data_updated', () => {
      // If user is actively uploading a video or typing unsaved changes, do NOT overwrite the active form
      if (uploadState.isUploading || isDirty) {
        api.get(`/courses/admin/${courseId}/content`).then(res => {
          if (res?.course) setCourse(res.course);
          if (res?.sections) setSections(res.sections);
        }).catch(() => {});
      } else {
        // Silently refresh content in the background without reloading the page
        fetchContent(editingLesson?._id, true);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [courseId, uploadState.isUploading, isDirty, editingLesson?._id]);

  const fetchContent = async (targetLessonId = null, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get(`/courses/admin/${courseId}/content`);
      if (!res) return;

      setCourse(res.course);
      const secs = res.sections || [];
      setSections(secs);

      const lessonIdToSelect = targetLessonId || editingLesson?._id;

      if (lessonIdToSelect) {
        for (const sec of secs) {
          const found = sec.lessons?.find(x => x._id === lessonIdToSelect);
          if (found) {
            setEditingLesson(found);
            setActiveSectionId(sec._id);
            setAssets(found.assets || []);
            setIsDirty(false);
            return;
          }
          if (sec.subsections) {
            for (const sub of sec.subsections) {
              const subFound = sub.lessons?.find(x => x._id === lessonIdToSelect);
              if (subFound) {
                setEditingLesson(subFound);
                setActiveSectionId(sub._id);
                setAssets(subFound.assets || []);
                setIsDirty(false);
                return;
              }
            }
          }
        }
      }

      // Auto-select first lesson if available and none selected
      if (!editingLesson && !lessonIdToSelect && secs.length > 0) {
        for (const sec of secs) {
          if (sec.lessons?.length > 0) {
            setEditingLesson(sec.lessons[0]);
            setActiveSectionId(sec._id);
            setAssets(sec.lessons[0].assets || []);
            setIsDirty(false);
            return;
          }
          if (sec.subsections?.length > 0) {
            for (const sub of sec.subsections) {
              if (sub.lessons?.length > 0) {
                setEditingLesson(sub.lessons[0]);
                setActiveSectionId(sub._id);
                setAssets(sub.lessons[0].assets || []);
                setIsDirty(false);
                return;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const selectLesson = (lesson, sectionId) => {
    if (uploadState.isUploading) {
      alert('لا يمكن الانتقال لمحاضرة أخرى أثناء رفع الفيديو، يرجى الانتظار حتى يكتمل.');
      return;
    }
    setEditingLesson(lesson);
    setActiveSectionId(sectionId);
    setAssets(lesson ? (lesson.assets || []) : []);
    setIsDirty(false);
  };

  const openAddMainSection = () => {
    setEditingSection(null);
    setParentSection(null);
    setSectionTitle('');
    setShowSectionForm(true);
  };

  const openAddSubSection = (parentSec) => {
    setEditingSection(null);
    setParentSection(parentSec);
    setSectionTitle('');
    setShowSectionForm(true);
  };

  const openAddLesson = (secId) => {
    if (uploadState.isUploading) {
      alert('لا يمكن إضافة محاضرة جديدة أثناء رفع فيديو، يرجى الانتظار.');
      return;
    }
    if (!sections || sections.length === 0) {
      alert('يرجى إنشاء قسم أولاً قبل إضافة المحاضرات.');
      openAddMainSection();
      return;
    }
    setActiveSectionId(secId || sections[0]?._id);
    setEditingLesson(null);
    setAssets([]);
    setBunnyStatus({ status: 4, statusText: 'جاهز للعرض', encodeProgress: 100, isReady: true });
    setIsDirty(false);
  };

  const handleSectionSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSection) {
        await api.put(`/courses/admin/sections/${editingSection._id}`, { title: sectionTitle });
      } else if (parentSection) {
        await api.post('/courses/admin/sections', { courseId, title: sectionTitle, parentId: parentSection._id });
      } else {
        await api.post('/courses/admin/sections', { courseId, title: sectionTitle });
      }
      setSectionTitle('');
      setEditingSection(null);
      setParentSection(null);
      setShowSectionForm(false);
      await fetchContent(editingLesson?._id, true);
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteSection = (sec, isSub = false) => {
    const secId = sec._id || sec;
    const title = sec.title || 'هذا القسم';
    const msg = isSub
      ? `حذف القسم الفرعي "${title}" سيحذف جميع المحاضرات التابعة له. متأكد من الحذف؟`
      : `حذف القسم الرئيسي "${title}" سيحذف جميع الأقسام الفرعية والمحاضرات التابعة له. متأكد من الحذف؟`;

    window.SwalConfirm(msg, async () => {
      try {
        await api.delete(`/courses/admin/sections/${secId}`);
        if (activeSectionId === secId) {
          setEditingLesson(null);
        }
        await fetchContent(null, true);
      } catch (err) {
        alert(err.message);
      }
    });
  };

  // Stream upload fallback to backend proxy
  const proxyUploadToBunny = (file, videoId, onProgress) => {
    return new Promise((resolve, reject) => {
      cancelPromiseRejectRef.current = reject;
      const xhr = new XMLHttpRequest();
      activeXhrRef.current = xhr;
      xhr.open('POST', `${getApiBaseUrl()}/courses/admin/lessons/bunny-stream-upload/${videoId}`, true);
      xhr.withCredentials = true; // Send admin auth cookies
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct, e.loaded, e.total);
        }
      };

      xhr.onload = () => {
        activeXhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const errRes = JSON.parse(xhr.responseText);
            reject(new Error(errRes.message || `فشل الرفع: ${xhr.status}`));
          } catch {
            reject(new Error(`فشل الرفع: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        activeXhrRef.current = null;
        if (isCancelledRef.current) {
          reject(new Error('UPLOAD_CANCELLED'));
        } else {
          reject(new Error('خطأ في الاتصال أثناء رفع الفيديو'));
        }
      };
      xhr.onabort = () => {
        activeXhrRef.current = null;
        reject(new Error('UPLOAD_CANCELLED'));
      };
      xhr.send(file);
    });
  };

  // Resumable Chunked Upload via TUS Protocol
  const uploadVideoResumable = (file, prepRes, lessonTitle, onProgressState) => {
    return new Promise((resolve, reject) => {
      cancelPromiseRejectRef.current = reject;

      if (!prepRes.signature || !prepRes.libraryId) {
        return proxyUploadToBunny(file, prepRes.videoId, (pct, loaded, total) => {
          onProgressState({ progress: pct, loaded, total, isResumable: false });
        }).then(resolve).catch(reject);
      }

      const upload = new tus.Upload(file, {
        endpoint: prepRes.tusEndpoint || `${getApiBaseUrl()}/courses/admin/lessons/tusupload`,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
        chunkSize: 5 * 1024 * 1024, // 5MB chunks for optimal reliability & resume
        withCredentials: true,
        storeFingerprintForResuming: false, // Prevents cross-video conflict
        headers: {
          AuthorizationSignature: prepRes.signature,
          AuthorizationExpire: prepRes.expiration.toString(),
          LibraryId: prepRes.libraryId.toString(),
          VideoId: prepRes.videoId
        },
        metadata: {
          filetype: file.type || 'video/mp4',
          title: lessonTitle
        },
        onError: (error) => {
          if (isCancelledRef.current) {
            reject(new Error('UPLOAD_CANCELLED'));
            return;
          }
          console.warn('TUS upload error/retry:', error);
          onProgressState({
            isRetrying: true,
            errorMsg: 'انقطع الاتصال مؤقتاً، جاري المحاولة واستئناف الرفع تلقائياً...'
          });
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (isCancelledRef.current) return;
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          onProgressState({
            progress: pct,
            loaded: bytesUploaded,
            total: bytesTotal,
            isResumable: true,
            isRetrying: false,
            isPaused: false,
            errorMsg: ''
          });
        },
        onSuccess: () => {
          activeTusUploadRef.current = null;
          cancelPromiseRejectRef.current = null;
          if (isCancelledRef.current) {
            reject(new Error('UPLOAD_CANCELLED'));
          } else {
            resolve();
          }
        }
      });

      activeTusUploadRef.current = upload;
      upload.start();
    });
  };

  const handlePauseUpload = () => {
    if (activeTusUploadRef.current) {
      activeTusUploadRef.current.abort();
      setUploadState(prev => ({ ...prev, isPaused: true, isRetrying: false }));
    }
  };

  const handleResumeUpload = () => {
    if (activeTusUploadRef.current) {
      setUploadState(prev => ({ ...prev, isPaused: false, isRetrying: false }));
      activeTusUploadRef.current.start();
    }
  };

  const handleCancelUpload = async () => {
    if (!uploadState.isUploading) return;

    const confirmed = window.confirm('هل أنت متأكد من إلغاء رفع الفيديو؟');
    if (!confirmed) return;

    isCancelledRef.current = true;

    // 1. Abort TUS upload if active
    if (activeTusUploadRef.current) {
      try {
        activeTusUploadRef.current.abort(true);
      } catch (err) {
        console.warn('Error aborting TUS:', err);
      }
      activeTusUploadRef.current = null;
    }

    // 2. Abort XHR if proxy upload is active
    if (activeXhrRef.current) {
      try {
        activeXhrRef.current.abort();
      } catch (err) {
        console.warn('Error aborting XHR:', err);
      }
      activeXhrRef.current = null;
    }

    // 3. Reject active upload promise
    if (cancelPromiseRejectRef.current) {
      try {
        cancelPromiseRejectRef.current(new Error('UPLOAD_CANCELLED'));
      } catch (e) {}
      cancelPromiseRejectRef.current = null;
    }

    // 4. Delete uncompleted video object on Bunny CDN
    const videoIdToDelete = currentPreparingVideoIdRef.current;
    if (videoIdToDelete) {
      try {
        await api.delete(`/courses/admin/lessons/bunny-cancel/${videoIdToDelete}`);
      } catch (err) {
        console.warn('Failed to delete cancelled video on Bunny:', err);
      }
      currentPreparingVideoIdRef.current = null;
    }

    // 5. Clear video file input in form
    const fileInputs = document.querySelectorAll('input[name="video_file"]');
    fileInputs.forEach(input => { input.value = ''; });

    // 6. Reset upload state
    setUploadState({
      isUploading: false,
      phase: null,
      progress: 0,
      loaded: 0,
      total: 0,
      isPaused: false,
      isRetrying: false,
      isResumable: false,
      errorMsg: ''
    });
  };

  const handleLessonSubmit = async (e) => {
    e.preventDefault();
    isCancelledRef.current = false;
    currentPreparingVideoIdRef.current = null;
    const form = e.target;
    const videoFileInput = form.querySelector('input[name="video_file"]');
    const videoFile = videoFileInput?.files?.[0];

    // Build FormData (without video_file - we handle it separately)
    const fd = new FormData(form);
    // Remove video_file from FormData since we'll upload it directly to Bunny
    fd.delete('video_file');

    // Validate section
    const currentSectionId = fd.get('sectionId') || activeSectionId || (sections.length > 0 ? sections[0]._id : null);
    if (!currentSectionId) {
      alert('لا يمكن إضافة المحاضرة بدون قسم. يرجى إنشاء قسم للكورس أولاً.');
      return;
    }

    if (!editingLesson) {
      fd.set('courseId', courseId);
      fd.set('sectionId', currentSectionId);
    } else {
      fd.set('section', currentSectionId);
    }
    fd.append('assets', JSON.stringify(assets));

    try {
      let savedReorders = false;
      if (Object.keys(pendingReorders).length > 0) {
        setUploadState({ isUploading: true, phase: 'save', progress: 0, loaded: 0, total: 0 });
        for (const sectionId of Object.keys(pendingReorders)) {
          await api.patch('/courses/admin/lessons/reorder', { sectionId, ids: pendingReorders[sectionId] });
        }
        setPendingReorders({});
        savedReorders = true;
      }

      // If nothing else was changed and we are editing an existing lesson, just exit early
      if (!isDirty && editingLesson) {
        if (savedReorders) {
          fetchContent(editingLesson._id);
          setUploadState({ isUploading: false, phase: null, progress: 0, loaded: 0, total: 0 });
          alert('تم حفظ التعديلات بنجاح.');
        }
        return;
      }

      let directBunnyVideoId = null;

      // STEP 1: If a video file is selected, stream it via backend proxy
      if (videoFile && videoFile.size > 0) {
        const lessonTitle = fd.get('title') || videoFile.name;

        // Get videoId from backend (creates video object on Bunny, NO API key returned)
        setUploadState({ isUploading: true, phase: 'prepare', progress: 0, loaded: 0, total: 0 });
        const prepRes = await api.post('/courses/admin/lessons/bunny-prepare', {
          title: lessonTitle,
          courseName: course.title,
          courseId: course._id
        });

        if (isCancelledRef.current) {
          if (prepRes?.videoId) {
            api.delete(`/courses/admin/lessons/bunny-cancel/${prepRes.videoId}`).catch(() => {});
          }
          return;
        }

        currentPreparingVideoIdRef.current = prepRes.videoId;

        // Resumable upload via TUS protocol (يكمل من حيث توقف دون إعادة من الصفر)
        setUploadState({
          isUploading: true,
          phase: 'upload',
          progress: 0,
          loaded: 0,
          total: videoFile.size,
          isResumable: true,
          isPaused: false,
          isRetrying: false,
          errorMsg: ''
        });

        await uploadVideoResumable(
          videoFile,
          prepRes,
          lessonTitle,
          (stateUpdates) => {
            setUploadState(prev => ({ ...prev, phase: 'upload', isUploading: true, ...stateUpdates }));
          }
        );

        if (isCancelledRef.current) return;

        directBunnyVideoId = prepRes.videoId;
        currentPreparingVideoIdRef.current = null;
        setBunnyProcessing(true);

        // Populate the external URL field with the Bunny Embed URL automatically
        if (prepRes.embedUrl) {
          fd.set('video_url', prepRes.embedUrl);
          fd.set('embed_url', prepRes.embedUrl);

          const videoUrlInput = form.querySelector('input[name="video_url"]');
          if (videoUrlInput) videoUrlInput.value = prepRes.embedUrl;
        }
      }

      if (isCancelledRef.current) return;

      // STEP 2: Save lesson to backend (without file, just metadata + bunny_video_id)
      if (directBunnyVideoId) {
        fd.set('bunny_video_id', directBunnyVideoId);
      }

      setUploadState(prev => ({ ...prev, phase: 'save' }));
      let res;
      if (editingLesson) {
        res = await api.put(`/courses/admin/lessons/${editingLesson._id}`, fd, true);
      } else {
        res = await api.post('/courses/admin/lessons', fd, true);
      }

      // Clear upload progress overlay immediately so updated lesson and video appear instantly
      setUploadState({ isUploading: false, phase: null, progress: 0, loaded: 0, total: 0, isPaused: false, isRetrying: false, isResumable: false, errorMsg: '' });
      if (res.lesson) {
        setEditingLesson(res.lesson);
        if (videoFileInput) videoFileInput.value = '';
        setIsDirty(false); // Reset dirty state on successful save
        await fetchContent(res.lesson._id, true);
      } else {
        setIsDirty(false);
        await fetchContent(null, true);
      }
    } catch (err) {
      if (err.message === 'UPLOAD_CANCELLED' || isCancelledRef.current) {
        console.log('Video upload cancelled by user.');
        return;
      }
      alert(err.message);
      setBunnyProcessing(false);
    } finally {
      currentPreparingVideoIdRef.current = null;
      isCancelledRef.current = false;
      setUploadState({ isUploading: false, phase: null, progress: 0, loaded: 0, total: 0, isPaused: false, isRetrying: false, isResumable: false, errorMsg: '' });
    }
  };

  const handleDeleteVideo = async () => {
    if (!editingLesson || !editingLesson._id) return;

    window.SwalConfirm('هل أنت متأكد من حذف الفيديو؟ سيتم حذفه نهائياً من قاعدة البيانات .', async () => {
      try {
        setBunnyProcessing(true);
        const res = await api.put(`/courses/admin/lessons/${editingLesson._id}`, { remove_video: 'true' });

        if (res.lesson) {
          setEditingLesson(res.lesson);
          setBunnyStatus({ status: 4, statusText: 'جاهز للعرض', encodeProgress: 100, isReady: true });
          await fetchContent(res.lesson._id, true);
        } else {
          await fetchContent(null, true);
        }
        alert('تم حذف الفيديو بنجاح.');
      } catch (err) {
        alert(err.message);
      } finally {
        setBunnyProcessing(false);
      }
    });
  };

  const deleteLesson = (id) => {
    window.SwalConfirm('متأكد من حذف المحاضرة؟', async () => {
      try {
        await api.delete(`/courses/admin/lessons/${id}`);
        if (editingLesson?._id === id) {
          setEditingLesson(null);
        }
        await fetchContent(null, true);
      } catch (err) {
        alert(err.message);
      }
    });
  };

  const moveLesson = (sectionId, fromIndex, toIndex) => {
    let targetSection = null;
    for (const s of sections) {
      if (s._id === sectionId) { targetSection = s; break; }
      if (s.subsections) {
        const found = s.subsections.find(sub => sub._id === sectionId);
        if (found) { targetSection = found; break; }
      }
    }
    if (!targetSection || !targetSection.lessons) return;

    // Create a copy of the lessons array
    const newLessons = [...targetSection.lessons];
    const [moved] = newLessons.splice(fromIndex, 1);
    newLessons.splice(toIndex, 0, moved);

    // Update local state immediately
    const updatedSections = sections.map(s => {
      if (s._id === sectionId) return { ...s, lessons: newLessons };
      if (s.subsections) {
        return {
          ...s,
          subsections: s.subsections.map(sub => sub._id === sectionId ? { ...sub, lessons: newLessons } : sub)
        };
      }
      return s;
    });
    setSections(updatedSections);

    // Store pending order
    const ids = newLessons.map(l => l._id);
    setPendingReorders(prev => ({ ...prev, [sectionId]: ids }));
  };

  const handleVideoFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const totalSeconds = Math.floor(video.duration);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const fmt = h > 0
          ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          : `${m}:${s.toString().padStart(2, '0')}`;
        const durInput = document.querySelector('input[name="duration"]');
        if (durInput) {
          durInput.value = fmt;
          setIsDirty(true);
        }
      };
      video.src = URL.createObjectURL(file);
    }
  };

  const handleRecalculateDuration = async () => {
    try {
      setDurationUpdating(true);
      const res = await api.post(`/courses/admin/${courseId}/recalculate-duration`);
      setCourse(prev => ({
        ...prev,
        duration: res.duration,
        duration_seconds: res.duration_seconds,
        is_duration_manual: false,
        calculated_duration: res.duration
      }));
      alert(res.message);
    } catch (err) {
      alert(err.message);
    } finally {
      setDurationUpdating(false);
    }
  };

  const handleSaveDurationModal = async (e) => {
    e.preventDefault();
    try {
      setDurationUpdating(true);
      const payload = {
        is_duration_manual: modalIsManual,
        duration: modalIsManual ? modalDurationInput.trim() : undefined
      };
      const res = await api.patch(`/courses/admin/${courseId}/duration`, payload);
      setCourse(prev => ({
        ...prev,
        duration: res.duration,
        is_duration_manual: res.is_duration_manual,
        calculated_duration: res.is_duration_manual ? prev.calculated_duration : res.duration
      }));
      setShowDurationModal(false);
      alert(res.message);
    } catch (err) {
      alert(err.message);
    } finally {
      setDurationUpdating(false);
    }
  };

  if (loading && !course) {
    return <AdminLayout title="المحتوى"><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;
  }
  if (!course) return <AdminLayout title="غير موجود">الكورس غير موجود</AdminLayout>;

  // Video embed / source helper
  const getLessonVideoPreview = () => {
    if (!editingLesson) return null;
    const embedUrl = editingLesson.embed_url || editingLesson.video_url;

    if (editingLesson.bunny_video_id || (embedUrl && (embedUrl.includes('mediadelivery.net') || embedUrl.includes('bunnycdn.com')))) {
      return (
        <div className="video-preview-card" style={{ marginBottom: '16px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#16a34a' }}>
              <i className="fa-solid fa-shield-halved"></i> معاينة
            </span>
            <small style={{ color: '#64748b', fontSize: '11px' }}>ID: {editingLesson.bunny_video_id || 'السيرفر السحابي'}</small>
          </div>
          <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '10px', overflow: 'hidden', background: '#000', border: '1px solid #cbd5e1' }}>
            <iframe
              key={bunnyStatus.isReady ? 'ready' : 'processing'}
              src={embedUrl}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              allowFullScreen
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            ></iframe>
          </div>
        </div>
      );
    }

    if (editingLesson.video_file) {
      return (
        <div className="video-preview-card" style={{ marginBottom: '16px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2563eb' }}>
              <i className="fa-solid fa-file-video"></i> معاينة الفيديو المرفوع
            </span>
          </div>
          <video
            controls
            src={editingLesson.video_file.startsWith('http') ? editingLesson.video_file : getAssetUrl(editingLesson.video_file)}
            style={{ width: '100%', borderRadius: '10px', background: '#000', border: '1px solid #cbd5e1' }}
          />
        </div>
      );
    }

    if (editingLesson.video_url && (editingLesson.video_url.includes('youtube.com') || editingLesson.video_url.includes('youtu.be'))) {
      let vid = editingLesson.video_url.split('v=')[1]?.split('&')[0];
      if (!vid) vid = editingLesson.video_url.split('/').pop();
      return (
        <div className="video-preview-card" style={{ marginBottom: '16px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#dc2626' }}>
              <i className="fa-brands fa-youtube"></i> معاينة يوتيوب
            </span>
          </div>
          <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '10px', overflow: 'hidden', background: '#000', border: '1px solid #cbd5e1' }}>
            <iframe
              src={`https://www.youtube.com/embed/${vid}`}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              allowFullScreen
            ></iframe>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderLessonsList = (lessonsList = [], secId) => {
    if (!lessonsList || lessonsList.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {lessonsList.map((l, j) => {
          const isSelected = editingLesson?._id === l._id;
          return (
            <div
              key={l._id}
              onClick={() => selectLesson(l, secId)}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: isSelected ? 'rgba(200, 30, 30, 0.08)' : '#fff',
                border: isSelected ? '1px solid #c81e1e' : '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: isSelected ? '#c81e1e' : '#94a3b8', minWidth: '18px' }}>
                  {j + 1}
                </span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: isSelected ? 'bold' : '600', color: isSelected ? '#c81e1e' : '#1e293b', lineHeight: '1.3' }}>
                    {l.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {l.duration && <span><i className="fa-regular fa-clock"></i> {l.duration}</span>}
                    {(l.bunny_video_id || l.embed_url) && <span style={{ color: '#16a34a' }}><i className="fa-solid fa-shield-halved"></i> سحابي</span>}
                    {l.video_file && !l.bunny_video_id && <span style={{ color: '#2563eb' }}><i className="fa-solid fa-video"></i> مرفوع</span>}
                    {l.is_preview && <span style={{ color: '#16a34a' }}><i className="fa-solid fa-eye"></i> مجاني</span>}
                  </div>
                </div>
              </div>

              <div className="row-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button
                    type="button"
                    className="btn btn-light btn-icon"
                    style={{ width: '22px', height: '13px', fontSize: '8px', padding: 0, borderRadius: '3px' }}
                    disabled={j === 0}
                    onClick={() => moveLesson(secId, j, j - 1)}
                    title="تحريك لأعلى"
                  >
                    <i className="fa-solid fa-chevron-up"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-light btn-icon"
                    style={{ width: '22px', height: '13px', fontSize: '8px', padding: 0, borderRadius: '3px' }}
                    disabled={j === lessonsList.length - 1}
                    onClick={() => moveLesson(secId, j, j + 1)}
                    title="تحريك لأسفل"
                  >
                    <i className="fa-solid fa-chevron-down"></i>
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm btn-icon"
                  style={{ width: '26px', height: '26px', fontSize: '11px' }}
                  onClick={() => deleteLesson(l._id)}
                  title="حذف المحاضرة"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const isSaveDisabled = uploadState.isUploading || bunnyProcessing || (!isDirty && !!editingLesson && Object.keys(pendingReorders).length === 0);

  return (
    <AdminLayout title={`إدارة محتوى الكورس: ${course.title}`}>
      {/* Top Bar Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/admin/courses" className="btn btn-light btn-sm" style={{ gap: '6px' }}>
            <i className="fa-solid fa-arrow-right"></i> الرجوع للكورسات
          </Link>

          {/* Course Duration Live Widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              <i className="fa-regular fa-clock" style={{ marginLeft: '4px', color: '#c81e1e' }}></i>
              مدة الكورس:
            </span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>
              {course.duration || 'غير محددة'}
            </strong>
            <span
              className={`pill ${course.is_duration_manual ? 'p-gray' : 'p-green'}`}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              title={course.is_duration_manual ? 'تم تحديدها يدوياً' : 'تُحسب تلقائياً من الفيديوهات'}
            >
              {course.is_duration_manual ? 'يدوي ✏️' : 'تلقائي ⚡'}
            </span>
            <button
              type="button"
              className="btn btn-light btn-sm"
              style={{ padding: '3px 8px', fontSize: '12px' }}
              onClick={() => {
                setModalDurationInput(course.duration || course.calculated_duration || '');
                setModalIsManual(course.is_duration_manual || false);
                setShowDurationModal(true);
              }}
              title="تعديل مدة الكورس (تلقائي / يدوي)"
            >
              <i className="fa-solid fa-pen-to-square"></i> تعديل
            </button>
            <button
              type="button"
              className="btn btn-light btn-sm"
              style={{ padding: '3px 8px', fontSize: '12px', color: '#16a34a' }}
              onClick={handleRecalculateDuration}
              disabled={durationUpdating}
              title="إعادة حساب المدة فوراً من الفيديوهات المرفوعة"
            >
              <i className={`fa-solid ${durationUpdating ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
            </button>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={openAddMainSection}
        >
          <i className="fa-solid fa-plus"></i> إضافة قسم رئيسي جديد
        </button>
      </div>

      {/* Inline Section Add/Edit Form */}
      {showSectionForm && (
        <div className="panel" style={{ marginBottom: '20px', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
          <div className="panel-body">
            <div style={{ marginBottom: '10px', fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editingSection ? (
                <>
                  <i className="fa-solid fa-pen text-red"></i>
                  <span>تعديل {parentSection ? 'القسم الفرعي' : 'القسم'}: <strong style={{ color: '#0f172a' }}>{editingSection.title}</strong></span>
                </>
              ) : parentSection ? (
                <>
                  <i className="fa-solid fa-folder-tree text-red"></i>
                  <span>إضافة قسم فرعي داخل: <strong style={{ color: '#0f172a' }}>{parentSection.title}</strong></span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-folder-plus text-red"></i>
                  <span>إضافة قسم رئيسي جديد للكورس</span>
                </>
              )}
            </div>
            <form className="inline-form" onSubmit={handleSectionSubmit} style={{ display: 'flex', gap: '10px' }}>
              <input
                placeholder={parentSection ? "اسم القسم الفرعي (مثال: الجزء الأول: الإعداد والتهيئة)" : "اسم القسم الرئيسي (مثال: أساسيات إطلاق الحملات الإعلانية)"}
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                required
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <button type="submit" className="btn btn-success"><i className="fa-solid fa-check"></i> حفظ القسم</button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => { setShowSectionForm(false); setParentSection(null); setEditingSection(null); setSectionTitle(''); }}
              >
                إلغاء
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2-Column Split Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* RIGHT COLUMN: Sections & Lessons List Panel */}
        <div className="panel" style={{ maxHeight: '85vh', overflowY: 'auto', position: 'sticky', top: '90px' }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2><i className="fa-solid fa-layer-group"></i> المحاضرات والأقسام</h2>
          </div>
          <div className="panel-body" style={{ padding: '12px' }}>
            {sections.map((sec, i) => (
              <div key={sec._id} style={{ marginBottom: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                {/* Section Title Header */}
                <div style={{ background: '#f1f5f9', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>
                    {i + 1}. {sec.title}
                  </span>
                  <div className="row-actions" style={{ gap: '4px' }}>
                    <button className="btn btn-light btn-sm btn-icon" title="إضافة محاضرة مباشرة في هذا القسم" onClick={() => openAddLesson(sec._id)}>
                      <i className="fa-solid fa-plus text-red"></i>
                    </button>
                    <button className="btn btn-light btn-sm btn-icon" title="إضافة قسم فرعي داخل هذا القسم" onClick={() => openAddSubSection(sec)}>
                      <i className="fa-solid fa-folder-tree" style={{ color: '#2563eb' }}></i>
                    </button>
                    <button className="btn btn-light btn-sm btn-icon" title="تعديل اسم القسم" onClick={() => { setEditingSection(sec); setSectionTitle(sec.title); setParentSection(null); setShowSectionForm(true); }}>
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button className="btn btn-danger btn-sm btn-icon" title="حذف القسم" onClick={() => deleteSection(sec, false)}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>

                {/* Section Content: Lessons & Sub-sections */}
                <div style={{ padding: '8px' }}>
                  {/* Direct lessons in main section */}
                  {renderLessonsList(sec.lessons, sec._id)}

                  {/* Sub-sections list */}
                  {sec.subsections && sec.subsections.length > 0 && (
                    <div style={{ marginTop: sec.lessons?.length ? '10px' : '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sec.subsections.map((sub, subIdx) => (
                        <div key={sub._id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                قسم فرعي
                              </span>
                              <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>
                                {subIdx + 1}. {sub.title}
                              </span>
                            </div>
                            <div className="row-actions" style={{ gap: '3px' }}>
                              <button className="btn btn-light btn-sm btn-icon" style={{ width: '24px', height: '24px' }} title="إضافة محاضرة للقسم الفرعي" onClick={() => openAddLesson(sub._id)}>
                                <i className="fa-solid fa-plus text-red" style={{ fontSize: '10px' }}></i>
                              </button>
                              <button className="btn btn-light btn-sm btn-icon" style={{ width: '24px', height: '24px' }} title="تعديل اسم القسم الفرعي" onClick={() => { setEditingSection(sub); setSectionTitle(sub.title); setParentSection(sec); setShowSectionForm(true); }}>
                                <i className="fa-solid fa-pen" style={{ fontSize: '10px' }}></i>
                              </button>
                              <button className="btn btn-danger btn-sm btn-icon" style={{ width: '24px', height: '24px' }} title="حذف القسم الفرعي" onClick={() => deleteSection(sub, true)}>
                                <i className="fa-solid fa-trash" style={{ fontSize: '10px' }}></i>
                              </button>
                            </div>
                          </div>

                          {renderLessonsList(sub.lessons, sub._id)}

                          {(!sub.lessons || sub.lessons.length === 0) && (
                            <div style={{ textAlign: 'center', padding: '6px', fontSize: '11px', color: '#94a3b8' }}>
                              لا توجد محاضرات في هذا القسم الفرعي
                              <button className="btn btn-link btn-sm" style={{ display: 'inline-block', marginRight: '6px', fontSize: '11px' }} onClick={() => openAddLesson(sub._id)}>+ إضافة محاضرة</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty section state */}
                  {(!sec.lessons || sec.lessons.length === 0) && (!sec.subsections || sec.subsections.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#94a3b8' }}>
                      لا توجد محاضرات أو أقسام فرعية
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
                        <button className="btn btn-link btn-sm" onClick={() => openAddLesson(sec._id)}>+ محاضرة مباشرة</button>
                        <button className="btn btn-link btn-sm" style={{ color: '#2563eb' }} onClick={() => openAddSubSection(sec)}>+ قسم فرعي</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sections.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                <i className="fa-solid fa-folder-open fa-2x" style={{ marginBottom: '8px', display: 'block' }}></i>
                لا توجد أقسام بعد. اضغط فوق لإضافة قسم.
              </div>
            )}
          </div>
        </div>

        {/* LEFT COLUMN: Main Active Lesson Editor Workspace */}
        <div className="panel" style={{ minHeight: '600px' }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>
              <i className="fa-solid fa-pen-to-square"></i> {editingLesson ? `تعديل المحاضرة: ${editingLesson.title}` : 'إضافة محاضرة جديدة'}
            </h2>
            {editingLesson && (
              <button className="btn btn-light btn-sm" onClick={() => openAddLesson(activeSectionId || sections[0]?._id)}>
                <i className="fa-solid fa-plus"></i> محاضرة جديدة
              </button>
            )}
          </div>

          <div className="panel-body">
            {sections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
                <i className="fa-solid fa-folder-plus text-red" style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}></i>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>
                  يجب إضافة قسم (سيكشن) أولاً قبل إضافة المحاضرات
                </h3>
                <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '450px', margin: '0 auto 20px' }}>
                  لتنظيم محتوى الكورس، يجب إنشاء قسم أولاً (مثال: أساسيات إطلاق الحملات الإعلانية) ثم إضافة المحاضرات بداخله.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openAddMainSection}
                >
                  <i className="fa-solid fa-plus"></i> إضافة قسم جديد الآن
                </button>
              </div>
            ) : (
            <form onSubmit={handleLessonSubmit} onChange={() => setIsDirty(true)} key={editingLesson ? editingLesson._id : 'new-form'}>
              <div className="form-grid">
                <div className="field full">
                  <label>القسم أو القسم الفرعي التابع له المحاضرة *</label>
                  <select
                    name="sectionId"
                    value={activeSectionId || (sections[0]?._id) || ''}
                    onChange={(e) => { setActiveSectionId(e.target.value); setIsDirty(true); }}
                    required
                    style={{ fontWeight: 'bold', padding: '10px 12px' }}
                  >
                    {sections.map(s => {
                      const hasSubs = s.subsections && s.subsections.length > 0;
                      if (!hasSubs) {
                        return (
                          <option key={s._id} value={s._id}>
                            {s.title}
                          </option>
                        );
                      }
                      return (
                        <optgroup key={s._id} label={`📁 ${s.title}`}>
                          <option value={s._id}>
                            {s.title} (مباشرة في القسم الرئيسي)
                          </option>
                          {s.subsections.map(sub => (
                            <option key={sub._id} value={sub._id}>
                              &nbsp;&nbsp;↳ {sub.title}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                <div className="field full">
                  <label>عنوان المحاضرة *</label>
                  <input name="title" defaultValue={editingLesson?.title} required placeholder="مثال: استراتيجيات تحديد الجمهور المستهدف (Target Audience)" />
                </div>

                <div className="field full" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block', color: '#0f172a' }}>
                    <i className="fa-solid fa-video text-red"></i> فيديو المحاضرة
                  </label>

                  {/* Compact Live Video Preview Box */}
                  {getLessonVideoPreview()}

                  {/* Bunny Stream Status & Transcoding Indicator Badge */}
                  {editingLesson?.bunny_video_id && (bunnyStatus.isReady || bunnyStatus.isDeleted || bunnyStatus.status === 5) && (
                    <div style={{
                      marginBottom: '14px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: bunnyStatus.isDeleted ? '#fef2f2' : (bunnyStatus.isReady ? '#f0fdf4' : (bunnyStatus.status === 5 ? '#fef2f2' : '#fef3c7')),
                      border: bunnyStatus.isDeleted ? '1px solid #fecaca' : (bunnyStatus.isReady ? '1px solid #bbf7d0' : (bunnyStatus.status === 5 ? '1px solid #fecaca' : '1px solid #fde047')),
                      color: bunnyStatus.isDeleted ? '#991b1b' : (bunnyStatus.isReady ? '#166534' : (bunnyStatus.status === 5 ? '#991b1b' : '#854d0e')),
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      {bunnyStatus.isDeleted ? (
                        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '20px', color: '#dc2626' }}></i>
                      ) : !bunnyStatus.isReady && bunnyStatus.status !== 5 ? (
                        <i className="fa-solid fa-gear fa-spin" style={{ fontSize: '20px', color: '#d97706' }}></i>
                      ) : (
                        <i className={bunnyStatus.isReady ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"} style={{ fontSize: '20px' }}></i>
                      )}

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13.5px' }}>
                          حالة الفيديو: {bunnyStatus.statusText}
                        </div>
                        {bunnyStatus.isDeleted && (
                          <div style={{ fontSize: '12px', marginTop: '4px', color: '#b91c1c' }}>
                            تم حذف هذا الفيديو من السيرفر. ارفع فيديو جديد لاستبداله.
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '12px' }}>
                    {(editingLesson?.bunny_video_id || editingLesson?.video_file) ? (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold' }}
                        onClick={handleDeleteVideo}
                      >
                        <i className="fa-solid fa-trash"></i> حذف الفيديو المرفوع
                      </button>
                    ) : (
                      <input
                        type="file"
                        name="video_file"
                        accept="video/mp4,video/webm,video/avi,video/mov"
                        onChange={handleVideoFileChange}
                      />
                    )}
                  </div>

                  {/* Inline Upload Progress Loader (Direct Bunny Upload) */}
                  {uploadState.isUploading && (
                    <div style={{
                      marginTop: '12px',
                      background: 'linear-gradient(145deg, #0f172a, #1e293b)',
                      padding: '16px',
                      borderRadius: '12px',
                      color: '#fff',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                    }}>
                      {uploadState.phase === 'prepare' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="fa-solid fa-circle-notch fa-spin text-red"></i>
                            <span>جاري تجهيز الفيديو للرفع على السيرفر...</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleCancelUpload}
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.5)',
                              color: '#fca5a5',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <i className="fa-solid fa-xmark"></i> إلغاء
                          </button>
                        </div>
                      )}
                      {uploadState.phase === 'upload' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {uploadState.isRetrying ? (
                                <><i className="fa-solid fa-triangle-exclamation text-amber-400 fa-bounce" style={{ color: '#fbbf24' }}></i>انقطع الاتصال — جاري المحاولة للاستئناف التلقائي...</>
                              ) : uploadState.isPaused ? (
                                <><i className="fa-solid fa-pause text-slate-300"></i> الرفع متوقف مؤقتاً ({uploadState.progress}%)</>
                              ) : (
                                <><i className="fa-solid fa-rocket fa-bounce" style={{ color: '#ff4d4d' }}></i>جاري الرفع ({uploadState.progress}%)</>
                              )}
                            </span>
                            <span style={{ color: '#f8fafc' }}>{uploadState.progress}%</span>
                          </div>

                          <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, uploadState.progress)}%`,
                              height: '100%',
                              background: uploadState.isRetrying ? 'linear-gradient(90deg, #d97706, #fbbf24)' : uploadState.isPaused ? '#64748b' : 'linear-gradient(90deg, #c81e1e, #ff4d4d)',
                              transition: 'width 0.15s ease-out'
                            }} />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px' }}>
                            {uploadState.total > 0 && (
                              <span style={{ color: '#94a3b8' }}>
                                {(uploadState.loaded / (1024 * 1024)).toFixed(1)} MB / {(uploadState.total / (1024 * 1024)).toFixed(1)} MB
                              </span>
                            )}

                            {/* Controls: Pause / Resume & Cancel */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {uploadState.isResumable && (
                                uploadState.isPaused || uploadState.isRetrying ? (
                                  <button
                                    type="button"
                                    onClick={handleResumeUpload}
                                    style={{ background: '#22c55e', border: 0, color: '#fff', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                                  >
                                    <i className="fa-solid fa-play"></i> استئناف الرفع
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handlePauseUpload}
                                    style={{ background: 'rgba(255,255,255,0.15)', border: 0, color: '#fff', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <i className="fa-solid fa-pause"></i> إيقاف مؤقت
                                  </button>
                                )
                              )}

                              <button
                                type="button"
                                onClick={handleCancelUpload}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid rgba(239, 68, 68, 0.5)',
                                  color: '#fca5a5',
                                  padding: '4px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontWeight: 'bold',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#fca5a5'; }}
                              >
                                <i className="fa-solid fa-xmark"></i> إلغاء الرفع
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                      {uploadState.phase === 'save' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                          <i className="fa-solid fa-floppy-disk fa-bounce text-red"></i>
                          <span>✅ تم الرفع — جاري حفظ بيانات الدرس...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post-Upload Bunny Transcoding Phase Indicator */}
                  {!uploadState.isUploading && bunnyProcessing && (
                    <div style={{
                      marginTop: '12px',
                      background: 'linear-gradient(145deg, #1c1917, #292524)',
                      padding: '16px',
                      borderRadius: '12px',
                      color: '#fff',
                      border: '1px solid rgba(251,191,36,0.3)',
                      boxShadow: '0 4px 14px rgba(251,191,36,0.1)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <i className="fa-solid fa-gear fa-spin" style={{ color: '#fbbf24', fontSize: '18px' }}></i>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#fef3c7' }}>
                            المعالجة السحابية — {bunnyStatus.status === 1 ? 'جاري الرفع على السيرفر...' : bunnyStatus.status === 2 ? ' جاري التحضير...' : `Transcoding (${bunnyStatus.encodeProgress}%)...`}
                          </div>
                          <div style={{ fontSize: '11px', color: '#a8a29e', marginTop: '2px' }}>
                            {bunnyStatus.status === 1 ? 'الملف وصل وجاري معالجته على الشبكة' : bunnyStatus.status === 2 ? 'جاري تحضير ملف الفيديو للمعالجة' : 'جاري تحويل الفيديو لصيغ متعددة (360p, 720p, 1080p)...'}
                          </div>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{
                          width: bunnyStatus.status === 1 ? '20%' : bunnyStatus.status === 2 ? '40%' : `${Math.max(45, bunnyStatus.encodeProgress)}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #d97706, #fbbf24)',
                          transition: 'width 0.5s ease-out',
                          animation: 'pulse 1.5s ease-in-out infinite'
                        }} />
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#78716c', textAlign: 'center' }}>
                        ⏳ ده بياخد من دقيقة لبضع دقايق — الصفحة بتتحدث أوتوماتيك لما يخلص
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #cbd5e1' }}>
                    <label style={{ fontSize: '13px', color: '#475569' }}>أدخل رابط فيديو خارجي</label>
                    <input
                      name="video_url"
                      dir="ltr"
                      defaultValue={editingLesson?.video_url}
                      placeholder="https://..."
                      style={{ marginTop: '4px' }}
                      disabled={!!editingLesson?.bunny_video_id || !!editingLesson?.video_file}
                      title={!!editingLesson?.bunny_video_id || !!editingLesson?.video_file ? "لا يمكنك إضافة رابط خارجي أثناء وجود ملف فيديو مرفوع" : ""}
                    />
                    {(!!editingLesson?.bunny_video_id || !!editingLesson?.video_file) && (
                      <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                        <i className="fa-solid fa-lock"></i> الحقل معطل لأن هناك ملف فيديو مرفوع بالفعل.
                      </div>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label>مدة المحاضرة</label>
                  <input name="duration" placeholder="مثال: 12:30" defaultValue={editingLesson?.duration} />
                </div>

                <div className="field full">
                  <label className="check" style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                    <input type="checkbox" name="is_preview" value="true" defaultChecked={editingLesson?.is_preview} />
                    <i className="fa-solid fa-eye text-green" style={{ marginLeft: '6px' }}></i>
                    محاضرة مجانية (معاينة قبل الاشتراك)
                  </label>
                </div>

                <div className="field full">
                  <label>وصف المحاضرة والملاحظات</label>
                  <textarea name="description" defaultValue={editingLesson?.description} style={{ minHeight: '90px' }} placeholder="اكتب وصفاً قصيراً أو ملاحظات للطلاب..."></textarea>
                </div>

                {/* Additional Attachments/Assets */}
                <div className="field full" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong><i className="fa-solid fa-paperclip"></i> روابط وملفات خارجية وملحقات (Drive, Sheets, قوالب الخ)</strong>
                    <button type="button" className="btn btn-dark btn-sm" onClick={() => setAssets([...assets, { title: '', url: '' }])}>
                      <i className="fa-solid fa-plus"></i> إضافة رابط
                    </button>
                  </label>
                  {assets.length === 0 && <p className="muted" style={{ fontSize: '13px' }}>لا توجد روابط مرفقة بهذه المحاضرة.</p>}
                  {assets.map((asset, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input type="text" placeholder="اسم الملف أو الملحق (مثال: شيت تحليل الحملات على Google Sheets)" value={asset.title} onChange={e => { const a = [...assets]; a[i].title = e.target.value; setAssets(a); setIsDirty(true); }} required style={{ flex: 1 }} />
                      <input type="url" dir="ltr" placeholder="https://..." value={asset.url} onChange={e => { const a = [...assets]; a[i].url = e.target.value; setAssets(a); setIsDirty(true); }} required style={{ flex: 2 }} />
                      <button type="button" className="btn btn-danger btn-icon" onClick={() => { const a = [...assets]; a.splice(i, 1); setAssets(a); setIsDirty(true); }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="full" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '12px', justifyContent: 'center', opacity: isSaveDisabled ? 0.65 : 1, cursor: isSaveDisabled ? 'not-allowed' : 'pointer' }}
                    disabled={isSaveDisabled}
                  >
                    {uploadState.isUploading && uploadState.phase === 'prepare' ? (
                      <><i className="fa-solid fa-circle-notch fa-spin"></i> جاري تجهيز الرفع على Bunny...</>
                    ) : uploadState.isUploading && uploadState.phase === 'upload' ? (
                      <><i className="fa-solid fa-cloud-arrow-up fa-bounce"></i> جاري رفع الفيديو ({uploadState.progress}%)...</>
                    ) : uploadState.isUploading && uploadState.phase === 'save' ? (
                      <><i className="fa-solid fa-floppy-disk fa-bounce"></i> جاري حفظ البيانات...</>
                    ) : bunnyProcessing ? (
                      <><i className="fa-solid fa-gear fa-spin"></i> Bunny يعمل Transcoding ({bunnyStatus.encodeProgress}%)...</>
                    ) : (
                      <><i className="fa-solid fa-floppy-disk"></i> {editingLesson ? 'حفظ التعديلات' : 'إضافة المحاضرة'}</>
                    )}
                  </button>

                  {isSaveDisabled && (
                    <small style={{ color: '#d97706', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                      {uploadState.isUploading
                        ? ' يرجى الانتظار حتى ينتهي الرفع — لا تغلق الصفحة'
                        : ''}
                    </small>
                  )}
                </div>
              </div>
            </form>
            )}
          </div>
        </div>

      </div>

      {/* Duration Edit Modal */}
      {showDurationModal && (
        <div className="modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="panel" style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                <i className="fa-regular fa-clock text-red"></i> تحديد مدة الكورس
              </h3>
              <button className="btn-icon" onClick={() => setShowDurationModal(false)} style={{ background: '#e2e8f0', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSaveDurationModal}>
              <div className="panel-body" style={{ padding: '20px' }}>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
                  يمكنك اختيار حساب مدة الكورس تلقائياً من فيديوهات المحاضرات أو كتابتها يدوياً.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  {/* Option 1: Auto */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', border: `2px solid ${!modalIsManual ? '#22c55e' : '#e2e8f0'}`, borderRadius: '10px', background: !modalIsManual ? '#f0fdf4' : '#fff', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="dur_type"
                      checked={!modalIsManual}
                      onChange={() => setModalIsManual(false)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>
                        ⚡ حساب تلقائي من الفيديوهات
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        المدة المحسوبة الحالية: <b style={{ color: '#16a34a' }}>{course.calculated_duration || '0 دقيقة'}</b> (تتحدث تلقائياً مع كل رفع جديد)
                      </span>
                    </div>
                  </label>

                  {/* Option 2: Manual */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', border: `2px solid ${modalIsManual ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '10px', background: modalIsManual ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="dur_type"
                      checked={modalIsManual}
                      onChange={() => setModalIsManual(true)}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>
                        ✏️ تحديد يدوي مخصص
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        اكتب المدة بنفسك كما تريد (مثل: 8 ساعات، مكثف - شهرين).
                      </span>
                    </div>
                  </label>
                </div>

                {modalIsManual && (
                  <div className="field" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>اكتب مدة الكورس:</label>
                    <input
                      value={modalDurationInput}
                      onChange={(e) => setModalDurationInput(e.target.value)}
                      placeholder="مثال: 8 ساعات"
                      required={modalIsManual}
                      autoFocus
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn btn-light" onClick={() => setShowDurationModal(false)}>
                    إلغاء
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={durationUpdating}>
                    {durationUpdating ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>} حفظ التغييرات
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default CourseContent;
