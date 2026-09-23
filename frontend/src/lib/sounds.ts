export const soundClips = {
  correct: { title: 'Bright chime', event: 'Correct answer' },
  wrong: { title: 'Gentle retry', event: 'Wrong answer' },
  complete: { title: 'Treasure chime', event: 'Quiz or course complete' },
  level_up: { title: 'Level-up fanfare', event: 'Reach a new level' },
};
export type SoundEvent = keyof typeof soundClips;
let context: AudioContext | undefined;
export function playCue(event: SoundEvent) {
  context ||= new AudioContext();
  void context.resume();
  const notes = event === 'wrong' ? [260, 200, 155] : event === 'complete' || event === 'level_up' ? [392, 494, 587, 784] : [523, 659, 784];
  notes.forEach((frequency, i) => {
    const oscillator = context!.createOscillator(), gain = context!.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    const start = context!.currentTime + i * .105;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.085, start + .018); gain.gain.exponentialRampToValueAtTime(.001, start + .25);
    oscillator.connect(gain); gain.connect(context!.destination); oscillator.start(start); oscillator.stop(start + .27);
  });
}
