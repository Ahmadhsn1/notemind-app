import { useState, useEffect, useLayoutEffect, useRef } from 'react';

function useEyes(mode, mousePos, ref) {
  const [eyeState, setEyeState] = useState({ pupil: { x: 0, y: 0 }, tilt: 0 });

  // useLayoutEffect (not useEffect): this reads the character's committed
  // DOM position via `ref`, which React only allows outside of render. Running
  // it before paint (instead of after, like useEffect) avoids a one-frame-stale
  // pupil position flashing on every mouse move.
  useLayoutEffect(() => {
    if (!ref.current) return;

    let next;
    if (mode === 'lookAtForm') {
      next = { pupil: { x: 4, y: 1 }, tilt: 5 };
    } else if (mode === 'shy') {
      next = { pupil: { x: -4, y: -2 }, tilt: -9 };
    } else if (mode === 'remind' || mode === 'glance') {
      next = { pupil: { x: 0, y: -3 }, tilt: 0 };
    } else if (!mousePos) {
      // No real pointer yet (e.g. touch device before the first tap) — rest
      // the eyes straight ahead instead of aiming at a stale (0,0) origin.
      next = { pupil: { x: 0, y: 0 }, tilt: 0 };
    } else {
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = mousePos.x - cx;
      const dy = mousePos.y - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(4, Math.hypot(dx, dy) / 40);
      next = {
        pupil: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
        tilt: Math.max(-6, Math.min(6, dx / 60)),
      };
    }

    setEyeState(next);
  }, [mousePos, mode, ref]);

  return eyeState;
}

function useBlink(delay) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let timeoutId;
    const scheduleBlink = () => {
      const nextBlink = 2500 + Math.random() * 3500;
      timeoutId = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 140);
      }, nextBlink);
    };
    timeoutId = setTimeout(scheduleBlink, delay);
    return () => clearTimeout(timeoutId);
  }, [delay]);

  return blinking;
}

function Eyes({ pupil, blinking, blush, size = 16, gap = 8 }) {
  const pupilSize = size * 0.45;
  const blushSize = size * 0.9;
  return (
    <div style={{ position: 'relative', display: 'flex', gap: `${gap}px`, justifyContent: 'center' }}>
      {blush && [0, 1].map((i) => (
        <div
          key={`blush-${i}`}
          style={{
            position: 'absolute',
            top: size * 0.8,
            left: i === 0 ? -blushSize * 0.6 : undefined,
            right: i === 1 ? -blushSize * 0.6 : undefined,
            width: blushSize,
            height: blushSize * 0.6,
            background: 'rgba(232, 67, 147, 0.55)',
            borderRadius: '50%',
            filter: 'blur(1.5px)',
          }}
        />
      ))}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            width: size,
            height: blinking ? 2 : size,
            background: '#fff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'height 0.08s ease-in-out',
            overflow: 'hidden',
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
              opacity: blinking ? 0 : 1,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function getCharClasses(mode, bounceKey) {
  const classes = ['relative', 'transition-transform', 'duration-[400ms]', 'ease-out', 'animate-char-float'];
  if (mode === 'shy' || mode === 'remind') classes.push('animate-char-wiggle!');
  if (bounceKey) classes.push('animate-char-bounce!');
  return classes.join(' ');
}

function Pencil({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(400);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} flex flex-col items-center mr-[-4px] z-[2]`}
      style={{ '--tilt': `${tilt - 4}deg` }}
      key={`pencil-${bounceKey}`}
    >
      <div className="w-[34px] h-[26px] bg-[#fd79a8] rounded-t-[8px]" />
      <div className="w-[34px] h-2 bg-[#b2bec3]" />
      <div className="w-[34px] h-[150px] bg-[#fdcb6e] relative">
        <div className="absolute top-[18px] left-0 right-0"><Eyes pupil={pupil} blinking={blinking} blush={mode === 'shy'} size={12} gap={5} /></div>
      </div>
      <div className="w-0 h-0 border-l-[17px] border-l-transparent border-r-[17px] border-r-transparent border-t-[26px] border-t-[#e8b665]" />
    </div>
  );
}

function Notebook({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(1200);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} [animation-delay:-1s] w-[110px] h-[140px] bg-[#6c5ce7] rounded-[10px] mr-[-8px] z-[3] shadow-[0_8px_30px_rgba(0,0,0,0.3)]`}
      style={{ '--tilt': `${tilt + 3}deg` }}
      key={`notebook-${bounceKey}`}
    >
      <div className="absolute left-2 top-2.5 bottom-2.5 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => <div key={i} className="w-2 h-2 border-2 border-white/60 rounded-full" />)}
      </div>
      <div className="absolute top-6 left-[34px] right-2"><Eyes pupil={pupil} blinking={blinking} blush={mode === 'shy'} size={16} gap={8} /></div>
      <div className="absolute h-[3px] bg-white/30 rounded-[2px] bottom-[34px] left-[38px] right-6" />
      <div className="absolute h-[3px] bg-white/30 rounded-[2px] bottom-[22px] left-[38px] right-4" />
    </div>
  );
}

function Bookmark({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(2100);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} [animation-delay:-2s] mr-[-6px] z-[2] drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)]`}
      style={{ '--tilt': `${tilt - 3}deg` }}
      key={`bookmark-${bounceKey}`}
    >
      <div className="w-16 h-[130px] bg-[#e84393] rounded-t-[8px] relative [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]">
        <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-3 h-3 border-[3px] border-white/50 rounded-full" />
        <div className="absolute top-[42px] left-0 right-0"><Eyes pupil={pupil} blinking={blinking} blush={mode === 'shy'} size={14} gap={7} /></div>
      </div>
    </div>
  );
}

function Folder({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(1700);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} [animation-delay:-0.5s] z-[1]`}
      style={{ '--tilt': `${tilt + 4}deg` }}
      key={`folder-${bounceKey}`}
    >
      <div className="w-[46px] h-4 bg-[#00b5b0] rounded-t-[8px] ml-1.5" />
      <div className="w-32 h-24 bg-[#00cec9] rounded-[4px_10px_10px_10px] relative shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
        <div className="absolute top-[22px] left-0 right-0"><Eyes pupil={pupil} blinking={blinking} blush={mode === 'shy'} size={16} gap={9} /></div>
      </div>
    </div>
  );
}

function Watchers({ mode, bounceKey }) {
  const [mousePos, setMousePos] = useState(null);

  useEffect(() => {
    const handleMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    // Touch devices never fire mousemove, so without this the "watch" eyes
    // would never get real coordinates — mirror mouse tracking with touch.
    const handleTouch = (e) => {
      if (e.touches.length > 0) {
        setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
    };
  }, []);

  return (
    <div className="flex items-end gap-[10px] relative scale-75 min-[500px]:scale-90 min-[800px]:scale-100 ml-0 min-[800px]:ml-[-40px]">
      {mode === 'remind' && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[14px] bg-white text-[#1a1443] text-[13px] font-semibold whitespace-nowrap py-2 px-3.5 rounded-[14px] shadow-[0_6px_20px_rgba(0,0,0,0.25)] z-[3] animate-bubble-pop after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[7px] after:border-transparent after:border-t-white">
          Hide your password...
        </div>
      )}
      <Pencil mode={mode} mousePos={mousePos} bounceKey={bounceKey} />
      <Notebook mode={mode} mousePos={mousePos} bounceKey={bounceKey} />
      <Bookmark mode={mode} mousePos={mousePos} bounceKey={bounceKey} />
      <Folder mode={mode} mousePos={mousePos} bounceKey={bounceKey} />
    </div>
  );
}

export default Watchers;
