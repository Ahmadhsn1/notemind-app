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
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              width: pupilSize,
              height: pupilSize,
              background: '#14161c',
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

// Shared drop-shadow (filter, not box-shadow) so it hugs each character's
// actual silhouette — including the ones clipped to a non-rectangular shape
// (Bookmark's ribbon notch), where a box-shadow would just draw a rectangle.
const CHAR_SHADOW = 'drop-shadow-[0_10px_22px_rgba(0,0,0,0.35)]';

function Pencil({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(400);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} ${CHAR_SHADOW} flex flex-col items-center mr-[-4px] z-[2]`}
      style={{ '--tilt': `${tilt - 4}deg` }}
      key={`pencil-${bounceKey}`}
    >
      {/* eraser */}
      <div
        className="w-9 h-7 rounded-t-[10px] relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #ffb3cd 0%, #fd79a8 60%, #f4568e 100%)' }}
      >
        <div className="absolute top-1 left-1.5 right-4 h-1.5 rounded-full bg-white/45" />
      </div>
      {/* ferrule */}
      <div
        className="w-9 h-2.5 relative"
        style={{ background: 'linear-gradient(180deg, #eef2f3 0%, #c2ccd0 45%, #96a3a8 100%)' }}
      >
        <div className="absolute inset-x-0 top-[3px] h-px bg-black/20" />
        <div className="absolute inset-x-0 bottom-[3px] h-px bg-black/20" />
      </div>
      {/* body */}
      <div
        className="w-9 h-[142px] relative"
        style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--color-amber) 65%, black) 0%, var(--color-amber) 42%, color-mix(in srgb, var(--color-amber) 78%, white) 62%, color-mix(in srgb, var(--color-amber) 65%, black) 100%)' }}
      >
        <div className="absolute top-[18px] left-0 right-0"><Eyes pupil={pupil} blinking={blinking} blush={mode === 'shy'} size={12} gap={5} /></div>
      </div>
      {/* wood tip + graphite point */}
      <div className="relative">
        <div
          className="w-0 h-0 border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[22px]"
          style={{ borderTopColor: '#f0c894' }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[14px] w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[9px]"
          style={{ borderTopColor: '#3a3632' }}
        />
      </div>
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
      className={`${getCharClasses(mode, bounceKey)} ${CHAR_SHADOW} [animation-delay:-1s] w-[112px] h-[142px] rounded-[16px] mr-[-8px] z-[3] relative overflow-hidden`}
      style={{ '--tilt': `${tilt + 3}deg`, background: 'linear-gradient(155deg, var(--color-accent) 0%, var(--color-accent-2) 100%)' }}
      key={`notebook-${bounceKey}`}
    >
      {/* soft sheen, top-left */}
      <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full bg-white/15 blur-md" />
      {/* corner ribbon bookmark */}
      <div
        className="absolute -top-1 right-4 w-3 h-6"
        style={{ background: '#ffce54', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)' }}
      />
      {/* spiral binding */}
      <div className="absolute left-2.5 top-3 bottom-3 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: 'linear-gradient(160deg, #ffffff, rgba(255,255,255,0.4))', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)' }}
          />
        ))}
      </div>
      <div className="absolute top-6 left-9 right-2.5"><Eyes pupil={pupil} blinking={blinking} blush={mode === 'shy'} size={16} gap={8} /></div>
      <div className="absolute h-[3px] rounded-[2px] bg-white/30 bottom-9 left-10 right-6" />
      <div className="absolute h-[3px] rounded-[2px] bg-white/30 bottom-6 left-10 right-4" />
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
      className={`${getCharClasses(mode, bounceKey)} ${CHAR_SHADOW} [animation-delay:-2s] mr-[-6px] z-[2]`}
      style={{ '--tilt': `${tilt - 3}deg` }}
      key={`bookmark-${bounceKey}`}
    >
      <div
        className="w-16 h-[132px] relative"
        style={{
          background: 'linear-gradient(160deg, #6ff0cf 0%, var(--color-growth) 55%, color-mix(in srgb, var(--color-growth) 75%, black) 100%)',
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
        }}
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-black/10" />
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full" style={{ boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.6)' }} />
        <div className="absolute top-11 left-0 right-0"><Eyes pupil={pupil} blinking={blinking} blush={mode === 'shy'} size={14} gap={7} /></div>
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
      className={`${getCharClasses(mode, bounceKey)} [animation-delay:-0.5s] z-[1] relative`}
      style={{ '--tilt': `${tilt + 4}deg` }}
      key={`folder-${bounceKey}`}
    >
      {/* paper peeking out from behind the tab */}
      <div className="absolute -top-2 left-4 right-4 h-6 rounded-t-[6px] bg-white/85" />
      <div
        className="w-12 h-4 rounded-t-[8px] ml-1.5 relative"
        style={{ background: 'linear-gradient(160deg, #b39cff, #8a6ef0)' }}
      />
      <div
        className={`w-32 h-24 rounded-[4px_14px_14px_14px] relative overflow-hidden ${CHAR_SHADOW}`}
        style={{ background: 'linear-gradient(155deg, #c3b0ff 0%, #9a7bff 55%, color-mix(in srgb, #9a7bff 75%, black) 100%)' }}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-white/25" />
        <div className="absolute top-[22px] left-0 right-0"><Eyes pupil={pupil} blinking={blinking} blush={mode === 'shy'} size={16} gap={9} /></div>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-black/10 blur-md" />
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
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[14px] bg-white text-[#14161c] text-[13px] font-semibold whitespace-nowrap py-2 px-3.5 rounded-[14px] shadow-[0_6px_20px_rgba(0,0,0,0.25)] z-[3] animate-bubble-pop after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[7px] after:border-transparent after:border-t-white">
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
