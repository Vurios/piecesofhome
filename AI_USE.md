# How we used AI

The NASA Space Apps Challenge allows AI tools when they are disclosed. This page lists every AI tool used for Pieces of Home, what it did, and what it did not do.

## Tools

| Tool | What it did |
|---|---|
| Claude Code (Anthropic), an AI coding assistant | Wrote most of the code, the in-game text drafts, the docs, the tests, the music and sound code, and the video kit, working from the team's direction and feedback rounds. It also researched the facts; every checked fact is tied to a public source link (see below). |
| Chatterbox TTS (Resemble AI), an open text-to-speech model (MIT), run locally | The narrator's voice in both videos (the local demo and the 30-second NASA video). The voice is synthetic, and Chatterbox adds an inaudible watermark that marks it as generated. Each line has a mood (hushed, curious, excited, proud) that sets how much expression the voice uses. Chatterbox speaks in the voice of a short reference clip; ours is synthetic too: Kokoro's "af_heart" voice (below) gave the first reference, and the brightest Chatterbox takes made from it, played a little faster, became the final one (`spark-quick.wav`). It is not a recording of a real person. Every sentence was read four or five times and the kit kept the take with the right words (checked by Whisper) and the liveliest delivery; every choice is logged in `video/audio/voice/takes.json`. |
| Kokoro-82M, an open text-to-speech model (Apache-2.0), run with kokoro-js | Made the 10-second reference clip (its "af_heart" voice) that gives Chatterbox its female voice. It was also the narrator of the first cut. |
| Whisper small.en (OpenAI, MIT), an open speech recognition model, run locally | Checked that every narration take says its script line, word for word, before the take could be kept. It writes nothing that viewers see or hear. |
| Parakeet / Whisper speech recognition, through the HyperFrames CLI | Checked that every narration clip says its script line, and timed the captions. |
| Google Gemini text-to-speech | Tried for the narration, not used: the key's prepaid credits had run out. |

No AI image generator was used. No AI music or sound model was used.

## What AI did not do

- **No fake NASA photos.** Every real photo in the game and the video is a NASA image with its exact credit line. Every illustration (the 3D worlds, Dad's drawings, the notebook) is drawn in code in the game's own toy style, so it reads as an illustration.
- **No made-up facts.** Every number, date and claim a player can read comes from `src/data/facts.json`, and every checked fact there (103 of 105) has a source title and link to a NASA, JPL or NSSDCA page that anyone can open; the other two are marked "verify" and cannot be used. `npm run check:facts` fails the build if the game uses a fact that has no source or is still marked "verify". The video script names the fact ID behind each claim (`video/script/demo.md`).
- **Music and sound effects are made in code.** The game's score and sounds are Web Audio code (written with AI help), plus CC0 instrument samples and CC0 sound effects. The video's score is new code in the same style (`video/audio/score.ts`), rendered offline.

## How it is marked

- The demo (4 min 25 s) says "Built with AI tools; see AI_USE.md" on its end card. Both videos carry the AI note in the MP4's metadata (comment and description) and in their upload descriptions. At the team's request there is no AI mark on the frames themselves.
- The slides name the AI tools on the team slide and the closing slide; the local description, the NASA project page answers (`docs/submission/global/GLOBAL_FORM.md`) and the organizers' form say the same.
- The video description and the project description point to this page.
- New commits made for the submission carry no AI co-author lines, at the team's request; this page is the disclosure.

## The people

Team Hackstreet Boys set the goal, chose the direction, played each build, and asked for changes in rounds of feedback (for example: cuter music, a quieter first volume, a bigger workshop, and putting the real machines first). The team is responsible for what is submitted.
