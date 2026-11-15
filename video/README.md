# Video kit

Makes the Pieces of Home demo video (and any later cut, such as a 30 second version) from the real game. Everything is code, so a new cut is a new script and edit list, not a new edit by hand.

```
script/<name>.json        the narration, line by line, with the fact ID behind each claim
script/<name>.edit.json   the edit: which footage plays under which lines, and the cards
script/<name>.md          the timecoded script (written by build-film)
shots/demo.ts             the gameplay shots: a save to start from, a setup, and what is played
tools/virtual-clock.js    frame-exact capture: holds the page's clock (injected by the capture script only)
tools/capture.ts          records shots from the real game at 1920x1080, 30 fps, and logs every sound by frame (--clean hides the HUD, for B-roll and the 30-second cut)
tools/tts_chatterbox.py   narration with Chatterbox (local, open, a mood per line, GPU if there is one); TAKES=n keeps the best of n takes per sentence
tools/voice_score.py      scores a take: Whisper checks the words, pitch and loudness movement measure how lively it is
tools/pace_voice.py       evens out the pace: slows rushed lines, lifts sleepy ones (pitch kept)
tools/tts.ts              the first cut's narration (Kokoro; or Gemini with a key), kept as a fallback
tools/verify-voice.mjs    transcribes each narration clip and reports its word error rate; keeps word timings
tools/build-film.ts       builds film/index.html (HyperFrames), film/plan.json, captions (.srt) and the timecoded script
audio/score.ts            the film's score, written in code with the game's instruments
tools/render-audio.ts     renders the score and the game's own sounds offline in Chrome
tools/mix.py              narration on top, music ducked under it, sounds on the frame, -16 LUFS, -1.5 dBTP
tools/finish.mjs          muxes picture and sound into the final MP4 with captions and the AI note in the metadata
tools/build-slides.ts     the presentation slides (PDF) from the same stills; slides-pptx.py adds a PowerPoint copy with notes
```

## Make the demo video

Needs Node 22+, Python 3 with NumPy, FFmpeg on the PATH, and Chrome. From the repo root:

```bash
npm install && (cd video && npm install)
npm run build && npx vite preview --port 4317     # the production game, with co-op rooms
npm run dev                                       # also needed: render-audio imports the audio code from the dev server

npx tsx video/tools/capture.ts video/shots/demo.ts --base=http://localhost:4317   # about 15 minutes
npx tsx video/tools/capture.ts video/shots/demo.ts --clean --base=http://localhost:4317   # the same shots without the HUD
TAKES=4 VOICE_REF=video/audio/voice/ref/spark-quick.wav video/.tts-venv/Scripts/python.exe video/tools/tts_chatterbox.py demo   # narration, best of 4 takes per sentence (first run downloads the models)
python -I video/tools/pace_voice.py demo
node video/tools/verify-voice.mjs video/audio/voice                              # check every line was said right
npx tsx video/tools/build-film.ts demo
npx tsx video/tools/render-audio.ts film
python -I video/tools/mix.py
(cd video/film && npx hyperframes render -o ../out/picture.mp4)                  # about an hour
node video/tools/finish.mjs demo
```

The result is `video/out/HackstreetBoys_PiecesOfHome_Demo.mp4` with `HackstreetBoys_PiecesOfHome_Demo.en.srt` beside it. Big files (captures, renders, audio builds) are git-ignored.

## Rules the kit keeps

- **Real gameplay only.** Shots run the real game. Outside the live demo, and in the 30-second cut, the clean captures hide the HUD so each frame reads at a glance; the live demo keeps the real HUD. Setups use the test hooks (`?test`) to start at the right moment; every demo shot is labeled "Live demo · real gameplay". The capture clock is injected by the capture script, so normal play is untouched.
- **Facts.** Every claim in the narration names its fact ID in `script/demo.json`; every number on screen comes from `src/data/facts.json` or from the game itself.
- **AI disclosure.** The end card says the video was built with AI tools; the MP4 metadata and the description say the same; the 30-second cut says it in its description and metadata; see `AI_USE.md`.
- **No dashes.** No em or en dashes in any text.
- **Sound.** The music is made in code (the score, with CC0 instrument samples); the effects are the game's own (made in code, plus CC0 samples); the voice is an open text-to-speech model (Chatterbox); no outside music or footage.

## The 30-second cut (NASA global)

`script/global30.json` (lines, fact IDs, moods) and `script/global30.edit.json` (beats with exact lengths, so each part of NASA's outline lands in its window). Every tool takes the cut's name, and its files live beside the first cut's (`film-global30/`, `audio/build-global30/`, `out/picture-global30.mp4`, `out/qa-global30/`):

```bash
TAKES=5 VOICE_REF=video/audio/voice/ref/spark-quick.wav video/.tts-venv/Scripts/python.exe video/tools/tts_chatterbox.py global30
python -I video/tools/pace_voice.py global30
node video/tools/verify-voice.mjs video/audio/voice
npx tsx video/tools/build-film.ts global30
CUT=global30 npx tsx video/tools/render-audio.ts film
CUT=global30 python -I video/tools/mix.py
(cd video/film-global30 && npx hyperframes render -o ../out/picture-global30.mp4)   # about 10 minutes
node video/tools/finish.mjs global30
CUT=global30 python -I video/tools/qa.py
npx tsx video/tools/build-cover.ts                                                  # the title page (docs/submission/cover/)
python -I video/tools/build-global-form.py                                          # GLOBAL_FORM.md and the Word answers, title page first
python -I video/tools/build-references.py                                           # NASA data and references (Word and references.md)
```

The web copy at `public/trailer/` is the same film re-encoded smaller (CRF 23, AAC 128 kb/s) with a poster frame and WebVTT captions: `node video/tools/web-trailer.mjs`.

## The narrator's voice

The voice is synthetic from start to finish. `audio/voice/ref/spark-quick.wav` is the reference Chatterbox speaks in: Kokoro's "af_heart" voice gave a first reference, the liveliest word-perfect Chatterbox takes made from it were joined into `spark.wav`, and that clip played 1.25 times faster (pitch kept) became `spark-quick.wav`, so the read is bright and keeps moving. The reference clips are git-ignored; rebuild them with the same steps if needed. Every sentence is read several times; `takes.json` beside the clips logs each take's words, pitch movement and pace, and which one was kept.

## Captions

Each caption chunk is timed from the words actually spoken: `build-film.ts` aligns the chunk's words to the transcription (`audio/voice/asr.json`, from `verify-voice.mjs`), shows it from a moment before its first word, and holds it until the next chunk takes over.
