"use strict";

const playButton = document.querySelector("#play-button");
const seekControl = document.querySelector("#track-seek");
const volumeControl = document.querySelector("#track-volume");
const timeDisplay = document.querySelector("#track-time");
const playerStatus = document.querySelector("#player-status");
const trackLength = 36;
const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

let audioContext;
let masterGain;
let trackBuffer;
let activeSource;
let startedAt = 0;
let playhead = 0;
let isPlaying = false;
let animationFrame;

function formatTime(seconds) {
  const wholeSeconds = Math.floor(seconds);
  return `${String(Math.floor(wholeSeconds / 60)).padStart(2, "0")}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function updateProgress() {
  if (isPlaying) {
    playhead = Math.min(trackLength, audioContext.currentTime - startedAt);
    seekControl.value = String(playhead);
    timeDisplay.textContent = `${formatTime(playhead)} / ${formatTime(trackLength)}`;
    if (playhead >= trackLength) {
      stopPlayback();
      playhead = 0;
      seekControl.value = "0";
      timeDisplay.textContent = `00:00 / ${formatTime(trackLength)}`;
      playerStatus.textContent = "試聽結束，謝謝聆聽";
      return;
    }
    animationFrame = requestAnimationFrame(updateProgress);
  }
}

function createDemoBuffer(context) {
  const sampleRate = context.sampleRate;
  const frameCount = Math.floor(sampleRate * trackLength);
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const samples = buffer.getChannelData(0);
  const chords = [
    [110, 130.81, 164.81],
    [87.31, 110, 130.81],
    [130.81, 164.81, 196],
    [98, 123.47, 146.83],
  ];
  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 392, 440];

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / sampleRate;
    const chord = chords[Math.floor(time / 9) % chords.length];
    const pad = chord.reduce((sum, frequency) => {
      return sum + Math.sin(2 * Math.PI * frequency * time) * 0.07
        + Math.sin(2 * Math.PI * frequency * 2.01 * time) * 0.018;
    }, 0);
    const melodyStep = Math.floor(time / 1.5);
    const melodyTime = time % 1.5;
    const melodyEnvelope = Math.exp(-melodyTime * 2.8) * Math.min(1, melodyTime * 12);
    const note = Math.sin(2 * Math.PI * melody[melodyStep % melody.length] * time) * melodyEnvelope * 0.14;
    const pulse = Math.sin(2 * Math.PI * 55 * time) * Math.exp(-(time % 0.75) * 8) * 0.04;
    const fadeIn = Math.min(1, time / 1.2);
    const fadeOut = Math.min(1, (trackLength - time) / 2);
    samples[frame] = (pad + note + pulse) * fadeIn * fadeOut;
  }
  return buffer;
}

async function startPlayback() {
  if (!AudioContextConstructor) {
    playerStatus.textContent = "此瀏覽器不支援音訊播放，請改用較新的瀏覽器。";
    return;
  }

  try {
    if (!audioContext) {
      audioContext = new AudioContextConstructor();
      masterGain = audioContext.createGain();
      masterGain.gain.value = Number(volumeControl.value);
      masterGain.connect(audioContext.destination);
      trackBuffer = createDemoBuffer(audioContext);
    }
    await audioContext.resume();
    activeSource = audioContext.createBufferSource();
    activeSource.buffer = trackBuffer;
    activeSource.connect(masterGain);
    activeSource.onended = () => {
      if (isPlaying && playhead >= trackLength - 0.1) {
        stopPlayback();
        playhead = 0;
        seekControl.value = "0";
        timeDisplay.textContent = `00:00 / ${formatTime(trackLength)}`;
        playerStatus.textContent = "試聽結束，謝謝聆聽";
      }
    };
    startedAt = audioContext.currentTime - playhead;
    isPlaying = true;
    activeSource.start(0, playhead);
    playButton.classList.add("is-playing");
    playButton.setAttribute("aria-label", "暫停新曲試聽");
    playButton.setAttribute("aria-pressed", "true");
    playerStatus.textContent = "正在播放原創器樂片段";
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(updateProgress);
  } catch (error) {
    console.error("Unable to play the audio preview.", error);
    playerStatus.textContent = "音訊無法播放，請確認瀏覽器允許音訊後再試。";
    stopPlayback();
  }
}

function stopPlayback() {
  isPlaying = false;
  cancelAnimationFrame(animationFrame);
  if (activeSource) {
    activeSource.onended = null;
    activeSource.stop();
    activeSource.disconnect();
    activeSource = null;
  }
  playButton.classList.remove("is-playing");
  playButton.setAttribute("aria-label", "播放新曲試聽");
  playButton.setAttribute("aria-pressed", "false");
}

playButton.addEventListener("click", () => {
  if (isPlaying) {
    playhead = Math.min(trackLength, audioContext.currentTime - startedAt);
    stopPlayback();
    seekControl.value = String(playhead);
    timeDisplay.textContent = `${formatTime(playhead)} / ${formatTime(trackLength)}`;
    playerStatus.textContent = "試聽已暫停";
    return;
  }
  if (playhead >= trackLength) {
    playhead = 0;
  }
  startPlayback();
});

seekControl.addEventListener("input", () => {
  playhead = Number(seekControl.value);
  timeDisplay.textContent = `${formatTime(playhead)} / ${formatTime(trackLength)}`;
  if (isPlaying) {
    stopPlayback();
    startPlayback();
  }
});

volumeControl.addEventListener("input", () => {
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(Number(volumeControl.value), audioContext.currentTime, 0.02);
  }
});