export function startRingtone(context: AudioContext): () => void {
  const playing = new Set<OscillatorNode>();
  function ring() {
    if (context.state !== 'running') return;
    const now = context.currentTime;
    // A gentle ascending and descending D-major chime.
    [587.33, 739.99, 880, 1174.66, 880, 739.99].forEach((frequency, index) => {
      const time = now + index * 0.22;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.065, time + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);
      gain.connect(context.destination);
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      playing.add(oscillator);
      oscillator.onended = () => {
        playing.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(time);
      oscillator.stop(time + 0.57);
    });
  }
  ring();
  const timer = setInterval(ring, 4200);
  return () => {
    clearInterval(timer);
    playing.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        /* The tone may have ended already. */
      }
    });
    playing.clear();
  };
}
