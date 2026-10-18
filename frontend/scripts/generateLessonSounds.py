"""Gera os sons curtos das lições (LJ.5.4): ondas senoidais com decaimento, sem amostra de terceiros, então não há
licença a registrar. Uso: python3 scripts/generateLessonSounds.py (grava em src/features/lessons/lessonFeedback/sounds)."""
import math
import struct
import wave
from pathlib import Path

RATE = 16000
OUT = Path(__file__).resolve().parent.parent / 'src/features/lessons/lessonFeedback/sounds'

# Notas em Hz (Dó6, Mi6, Sol6, Dó7).
C6, E6, G6, C7 = 1046.5, 1318.5, 1568.0, 2093.0


def tone(freq, seconds, volume=0.35):
    samples = int(RATE * seconds)
    out = []
    for i in range(samples):
        t = i / RATE
        attack = min(1.0, t / 0.005)
        decay = math.exp(-t * 9 / seconds)
        out.append(volume * attack * decay * math.sin(2 * math.pi * freq * t))
    return out


def sequence(notes):
    # Cada nota entra quando a anterior ainda soa (soma das caudas), para soar como um motivo só.
    total = max(start + len(tone(freq, dur)) / RATE for start, freq, dur in notes)
    mix = [0.0] * int(RATE * total)
    for start, freq, dur in notes:
        offset = int(RATE * start)
        for i, v in enumerate(tone(freq, dur)):
            mix[offset + i] += v
    return mix


def write(name, samples):
    with wave.open(str(OUT / name), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, v)) * 32767)) for v in samples))


write('correct.wav', sequence([(0.0, E6, 0.10), (0.07, G6, 0.14)]))
write('goal.wav', sequence([(0.0, C6, 0.12), (0.09, E6, 0.12), (0.18, G6, 0.2)]))
write('complete.wav', sequence([(0.0, C6, 0.14), (0.1, E6, 0.14), (0.2, G6, 0.14), (0.3, C7, 0.3)]))
