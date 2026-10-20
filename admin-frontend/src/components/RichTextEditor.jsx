import { useRef, useEffect, useState } from 'react';

function RichTextEditor({ value = '', onChange, name, placeholder = 'اكتب هنا...' }) {
  const editorRef = useRef(null);
  const [activeAlign, setActiveAlign] = useState('right');

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current && onChange) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const exec = (command, val = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    handleInput();
  };

  // Font size changer using inline style span wrapping for clean CSS font-size
  const applyFontSize = (fontSizePx) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      // If no text selected, we can format block or document
      document.execCommand('fontSize', false, '3');
      return;
    }
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = fontSizePx;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      // Reselect the span
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    } catch {
      document.execCommand('fontSize', false, '3');
    }
    handleInput();
  };

  // Line height / Spacing adjuster on current block/paragraph or entire selection
  const applyLineHeight = (lh) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    // Find closest block element or apply to paragraph/div
    let node = selection.anchorNode;
    while (node && node !== editorRef.current && (!node.style || !['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'LI'].includes(node.nodeName))) {
      node = node.parentNode;
    }

    if (node && node !== editorRef.current) {
      node.style.lineHeight = lh;
      node.style.marginBottom = lh === '1.2' ? '4px' : lh === '1.5' ? '8px' : lh === '1.8' ? '14px' : '20px';
    } else {
      // Wrap selection in div with line-height
      const range = selection.getRangeAt(0);
      const div = document.createElement('div');
      div.style.lineHeight = lh;
      div.style.marginBottom = lh === '1.2' ? '4px' : lh === '1.5' ? '8px' : lh === '1.8' ? '14px' : '20px';
      try {
        div.appendChild(range.extractContents());
        range.insertNode(div);
      } catch {
        // fallback
      }
    }
    handleInput();
  };

  // Padding / Margin (remove/add spacing between lines & blocks)
  const applySpacingMode = (spacingType) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let node = selection.anchorNode;
    while (node && node !== editorRef.current && (!node.style || !['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'LI'].includes(node.nodeName))) {
      node = node.parentNode;
    }

    if (spacingType === 'compact') {
      // اشيل المسافات والبادينج
      if (node && node !== editorRef.current) {
        node.style.margin = '0px';
        node.style.padding = '0px';
        node.style.lineHeight = '1.3';
      } else {
        exec('formatBlock', '<div>');
      }
    } else if (spacingType === 'normal') {
      if (node && node !== editorRef.current) {
        node.style.margin = '0 0 10px 0';
        node.style.padding = '0px';
        node.style.lineHeight = '1.7';
      }
    } else if (spacingType === 'loose') {
      // مسافات واسعة
      if (node && node !== editorRef.current) {
        node.style.margin = '0 0 20px 0';
        node.style.padding = '4px 0';
        node.style.lineHeight = '2.1';
      }
    }
    handleInput();
  };

  const colors = [
    { label: 'أبيض / افتراضي', color: '#f8fafc' },
    { label: 'أحمر المنصة', color: '#ef4444' },
    { label: 'برتقالي', color: '#f97316' },
    { label: 'أصفر ذهبي', color: '#f59e0b' },
    { label: 'أخضر فسفوري', color: '#10b981' },
    { label: 'سماوي / كحلي', color: '#06b6d4' },
    { label: 'أزرق', color: '#3b82f6' },
    { label: 'بنفسجي', color: '#a855f7' },
    { label: 'رمادي خافت', color: '#94a3b8' }
  ];

  return (
    <div className="rich-editor-box" style={{ border: '1px solid #374151', borderRadius: '12px', background: '#0f172a', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      {/* Hidden input to submit with FormData */}
      <input type="hidden" name={name} value={value || ''} />

      {/* Toolbar Row 1: Formatting & Font Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        background: '#1e293b',
        borderBottom: '1px solid #334155'
      }}>
        {/* Block Type (العناوين والفقرات) */}
        <select
          onChange={(e) => {
            if (e.target.value) exec('formatBlock', e.target.value);
            e.target.value = '';
          }}
          title="نوع النص / العنوان"
          style={selectStyle}
        >
          <option value="">نوع النص...</option>
          <option value="<p>">فقرة عادية (Paragraph)</option>
          <option value="<h3>">عنوان كبير (Heading 3)</option>
          <option value="<h4>">عنوان متوسط (Heading 4)</option>
          <option value="<h5>">عنوان صغير (Heading 5)</option>
          <option value="<blockquote>">اقتباس (Quote)</option>
        </select>

        {/* Font Size Selector */}
        <select
          onChange={(e) => {
            if (e.target.value) applyFontSize(e.target.value);
            e.target.value = '';
          }}
          title="حجم الخط"
          style={selectStyle}
        >
          <option value="">حجم الخط...</option>
          <option value="12px">صغير جداً (12px)</option>
          <option value="14px">صغير (14px)</option>
          <option value="16px">عادي (16px)</option>
          <option value="18px">متوسط (18px)</option>
          <option value="22px">كبير (22px)</option>
          <option value="26px">كبير جداً (26px)</option>
          <option value="32px">ضخم (32px)</option>
        </select>

        <span style={dividerStyle}></span>

        {/* Bold */}
        <button
          type="button"
          onClick={() => exec('bold')}
          title="عريض (Bold)"
          style={btnStyle}
        >
          <i className="fa-solid fa-bold"></i>
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => exec('italic')}
          title="مائل (Italic)"
          style={btnStyle}
        >
          <i className="fa-solid fa-italic"></i>
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => exec('underline')}
          title="تسطير (Underline)"
          style={btnStyle}
        >
          <i className="fa-solid fa-underline"></i>
        </button>

        {/* Strike */}
        <button
          type="button"
          onClick={() => exec('strikeThrough')}
          title="شطب في المنتصف"
          style={btnStyle}
        >
          <i className="fa-solid fa-strikethrough"></i>
        </button>

        <span style={dividerStyle}></span>

        {/* Alignment */}
        <button
          type="button"
          onClick={() => { exec('justifyRight'); setActiveAlign('right'); }}
          title="محاذاة لليمين"
          style={{ ...btnStyle, background: activeAlign === 'right' ? '#334155' : 'rgba(255,255,255,0.06)' }}
        >
          <i className="fa-solid fa-align-right"></i>
        </button>
        <button
          type="button"
          onClick={() => { exec('justifyCenter'); setActiveAlign('center'); }}
          title="توسيط"
          style={{ ...btnStyle, background: activeAlign === 'center' ? '#334155' : 'rgba(255,255,255,0.06)' }}
        >
          <i className="fa-solid fa-align-center"></i>
        </button>
        <button
          type="button"
          onClick={() => { exec('justifyLeft'); setActiveAlign('left'); }}
          title="محاذاة لليسار"
          style={{ ...btnStyle, background: activeAlign === 'left' ? '#334155' : 'rgba(255,255,255,0.06)' }}
        >
          <i className="fa-solid fa-align-left"></i>
        </button>

        <span style={dividerStyle}></span>

        {/* Lists */}
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          title="قائمة نقطية"
          style={btnStyle}
        >
          <i className="fa-solid fa-list-ul"></i>
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          title="قائمة رقمية"
          style={btnStyle}
        >
          <i className="fa-solid fa-list-ol"></i>
        </button>

        <span style={dividerStyle}></span>

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() => exec('removeFormat')}
          title="إزالة كل التنسيقات"
          style={{ ...btnStyle, color: '#f87171' }}
        >
          <i className="fa-solid fa-eraser"></i>
        </button>
      </div>

      {/* Toolbar Row 2: Spacing, Line Height & Colors */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 12px',
        background: '#141e30',
        borderBottom: '1px solid #283548',
        fontSize: '12.5px'
      }}>
        {/* Line Height Selector */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <i className="fa-solid fa-arrows-up-down" style={{ fontSize: '11px' }}></i> تباعد الأسطر:
          </span>
          <select
            onChange={(e) => {
              if (e.target.value) applyLineHeight(e.target.value);
              e.target.value = '';
            }}
            title="تباعد الأسطر (Line-Height)"
            style={{ ...selectStyle, padding: '3px 8px', fontSize: '11.5px' }}
          >
            <option value="">اختر التباعد...</option>
            <option value="1.2">ضيق جداً (1.2)</option>
            <option value="1.4">متقارب (1.4)</option>
            <option value="1.7">طبيعي (1.7)</option>
            <option value="2.0">واسع (2.0)</option>
            <option value="2.4">متباعد جداً (2.4)</option>
          </select>
        </div>

        <span style={dividerStyle}></span>

        {/* Spacing / Padding controls */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#94a3b8' }}>مسافات الفقرات:</span>
          <button
            type="button"
            onClick={() => applySpacingMode('compact')}
            title="إلغاء المسافات والبادينج تماماً (ملاصق)"
            style={{ ...tagBtnStyle, borderColor: '#ef4444', color: '#fca5a5' }}
          >
            <i className="fa-solid fa-compress"></i> بدون مسافات
          </button>
          <button
            type="button"
            onClick={() => applySpacingMode('normal')}
            title="مسافة متوسطة بين الفقرات"
            style={tagBtnStyle}
          >
            عادية
          </button>
          <button
            type="button"
            onClick={() => applySpacingMode('loose')}
            title="مسافة وبادينج مريح بين الفقرات"
            style={{ ...tagBtnStyle, borderColor: '#10b981', color: '#6ee7b7' }}
          >
            <i className="fa-solid fa-expand"></i> متباعدة
          </button>
        </div>

        <span style={dividerStyle}></span>

        {/* Color Palette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <i className="fa-solid fa-palette" style={{ fontSize: '11px' }}></i> اللون:
          </span>
          {colors.map(c => (
            <button
              key={c.color}
              type="button"
              onClick={() => exec('foreColor', c.color)}
              title={c.label}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: c.color,
                border: '1.5px solid rgba(255,255,255,0.4)',
                cursor: 'pointer',
                padding: 0,
                outline: 'none',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            />
          ))}
          {/* Custom color picker */}
          <label title="لون مخصص" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
            <input
              type="color"
              onChange={(e) => exec('foreColor', e.target.value)}
              style={{
                width: '20px',
                height: '20px',
                padding: 0,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: 'transparent'
              }}
            />
          </label>
        </div>
      </div>

      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        style={{
          minHeight: '140px',
          maxHeight: '360px',
          overflowY: 'auto',
          padding: '16px',
          outline: 'none',
          color: '#f8fafc',
          fontSize: '15px',
          lineHeight: '1.7',
          direction: 'rtl',
          textAlign: 'right',
          fontFamily: 'inherit'
        }}
        data-placeholder={placeholder}
      />
      {name && <input type="hidden" name={name} value={value || ''} />}
    </div>
  );
}

const dividerStyle = {
  width: '1px',
  height: '22px',
  background: '#374151',
  margin: '0 4px'
};

const selectStyle = {
  background: '#0f172a',
  color: '#e2e8f0',
  border: '1px solid #475569',
  borderRadius: '6px',
  padding: '5px 8px',
  fontSize: '12px',
  cursor: 'pointer',
  outline: 'none'
};

const btnStyle = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#e2e8f0',
  borderRadius: '6px',
  width: '30px',
  height: '30px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '13px',
  transition: 'all 0.15s ease'
};

const tagBtnStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid #475569',
  color: '#cbd5e1',
  borderRadius: '5px',
  padding: '3px 8px',
  fontSize: '11px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.15s ease'
};

export default RichTextEditor;
