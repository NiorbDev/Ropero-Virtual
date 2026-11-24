import { useEffect, useId, useRef, useState } from "react";
import { useUiText } from "../ui-language";

const tracks = [
  { title: "Friday Morning", file: "friday-morning.mp3", isrc: "USUAN1100224" },
  { title: "Easy Lemon", file: "easy-lemon.mp3", isrc: "USUAN1200076" },
  { title: "Morning", file: "morning.mp3", isrc: "USUAN2300003" },
  { title: "Carefree", file: "carefree.mp3", isrc: "USUAN1400037" },
];

export function BackgroundMusic({ visible }: { visible: boolean }) {
  const ui = useUiText();
  const titleId = useId();
  const audio = useRef<HTMLAudioElement>(null);
  const [track] = useState(() => tracks[Math.floor(Math.random() * tracks.length)]);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const stopAutoplay = useRef<(() => void) | null>(null);

  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    let active = true;
    function removeRetry() {
      active = false;
      document.removeEventListener("click", retry, true);
      document.removeEventListener("keydown", retry, true);
    }
    function retry(event: Event) {
      if (!active || (event.target instanceof Element && event.target.closest("[data-music-toggle]"))) return;
      removeRetry();
      if (player?.paused) void Promise.resolve(player.play()).catch(() => {});
    }
    stopAutoplay.current = removeRetry;
    // A capture listener preserves the user gesture Safari needs for playback.
    document.addEventListener("click", retry, true);
    document.addEventListener("keydown", retry, true);
    void Promise.resolve(player.play()).then(removeRetry, () => {});
    return removeRetry;
  }, []);

  async function toggle() {
    stopAutoplay.current?.();
    const player = audio.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      await player.play();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="wardrobe-transfer developer-contact" hidden={!visible} aria-labelledby={titleId}>
      <h2 id={titleId}>{ui("Música de fondo")}</h2>
      <audio ref={audio} src={import.meta.env.BASE_URL + "music/" + track.file}
        preload="none" loop onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onError={() => { setFailed(true); setPlaying(false); }} />
      <button className="primary-button compact" type="button" data-music-toggle onClick={() => void toggle()}
        disabled={pending}>
        {ui(playing ? "Pausar música" : "Reproducir música")}
      </button>
      {failed && <p role="status">{ui("No se pudo reproducir la música. Intenta de nuevo.")}</p>}
      <p>
        <a href={`https://incompetech.com/music/royalty-free/index.html?isrc=${track.isrc}`}>{track.title} · Kevin MacLeod</a>
        {" · "}<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
        {" · "}{ui("Volumen reducido y archivo comprimido.")}
      </p>
    </section>
  );
}
