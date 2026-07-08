import { useState, useEffect, useRef } from 'react';

function useEyes(mode, mousePos, ref) {
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    if (!ref.current) return;

    if (mode === 'lookAtForm') {
      setPupil({ x: 4, y: 1 });
      setTilt(5);
      return;
    }
    if (mode === 'shy') {
      setPupil({ x: -4, y: -2 });
      setTilt(-9);
      return;
    }

    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mousePos.x - cx;
    const dy = mousePos.y - cy;
    const angle = Math.atan2(dy, dx);
    const dist = Math.min(4, Math.hypot(dx, dy) / 40);

    setPupil({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
    setTilt(Math.max(-6, Math.min(6, dx / 60)));
  }, [mousePos, mode, ref]);

  return { pupil, tilt };
}

function Eyes({ pupil, size = 16, gap = 8 }) {
  const pupilSize = size * 0.45;
  return (
    <div style={{ display: 'flex', gap: `${gap}px`, justifyContent: 'center' }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            background: '#fff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: pupilSize,
              height: pupilSize,
              background: '#1a1443',
              borderRadius: '50%',
              transform: `translate(${pupil.x}px, ${pupil.y}px)`,
              transition: 'transform 0.15s ease-out',
            }}
          />
        </div>
      ))}
    </div>
  );
}

function Pencil({ mode, mousePos }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  return (
    <div
      ref={ref}
      className="char char-pencil"
      style={{ transform: `rotate(${tilt - 4}deg)` }}
    >
      <div className="pencil-eraser" />
      <div className="pencil-band" />
      <div className="pencil-body">
        <div className="char-eyes"><Eyes pupil={pupil} size={12} gap={5} /></div>
      </div>
      <div className="pencil-tip" />
    </div>
  );
}

function Notebook({ mode, mousePos }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  return (
    <div
      ref={ref}
      className="char char-notebook"
      style={{ transform: `rotate(${tilt + 3}deg)` }}
    >
      <div className="notebook-rings">
        {[0, 1, 2, 3].map((i) => <div key={i} className="ring" />)}
      </div>
      <div className="notebook-eyes"><Eyes pupil={pupil} size={16} gap={8} /></div>
      <div className="notebook-line line-1" />
      <div className="notebook-line line-2" />
    </div>
  );
}

function Bookmark({ mode, mousePos }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  return (
    <div
      ref={ref}
      className="char char-bookmark"
      style={{ transform: `rotate(${tilt - 3}deg)` }}
    >
      <div className="bookmark-body">
        <div className="bookmark-hole" />
        <div className="bookmark-eyes"><Eyes pupil={pupil} size={14} gap={7} /></div>
      </div>
    </div>
  );
}

function Folder({ mode, mousePos }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  return (
    <div
      ref={ref}
      className="char char-folder"
      style={{ transform: `rotate(${tilt + 4}deg)` }}
    >
      <div className="folder-tab" />
      <div className="folder-body">
        <div className="folder-eyes"><Eyes pupil={pupil} size={16} gap={9} /></div>
      </div>
    </div>
  );
}

function Watchers({ mode }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div className="watchers">
      <Pencil mode={mode} mousePos={mousePos} />
      <Notebook mode={mode} mousePos={mousePos} />
      <Bookmark mode={mode} mousePos={mousePos} />
      <Folder mode={mode} mousePos={mousePos} />
    </div>
  );
}

export default Watchers;
