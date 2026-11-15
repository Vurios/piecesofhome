# Organizers' checklist (local event, NASA Space Apps Challenge 2026)

Status on November 15, 2026. "Team" means a person on the team has to do it; the steps are in the team's private checklist.

## Deadline and form

| Requirement | Status | Evidence |
|---|---|---|
| Submit by November 15, 2026, 5:00 PM PHT | Team | Everything below is ready to paste or upload |
| Team name | Ready | Hackstreet Boys |
| Project name | Ready | Pieces of Home |
| Members and roles | Names ready; roles: Team | README.md, "Team" |
| Contact person, email and mobile | Contact ready (Adrian Kim P. De Guzman); email and mobile: Team | Kept out of the public repo on purpose |
| NASA challenge, exact as on the NASA site | Ready (confirmed by the team) | Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars |
| Official NASA submission link | Team (after the global submission) | |
| Project description, 250 words or fewer, with problem, solution and NASA data by name and source | Ready, 248 words | [description.md](description.md) |
| NASA datasets used | Ready | [datasets.md](datasets.md): 9 NASA sources with full links and how each is used; all open without a login |
| Slides link (PDF, PPTX allowed), sized to the time limit | PDF and PPTX ready; upload and link: Team | [PiecesOfHome_Slides.pdf](PiecesOfHome_Slides.pdf) (7 slides, about 4 minutes of talk; speaker notes in [speaker-notes.md](speaker-notes.md)); `PiecesOfHome_Slides.pptx` with the same notes is built locally; shorter slot: keep each note to its first two sentences |
| Demo video link | MP4 ready; upload and link: Team | `HackstreetBoys_PiecesOfHome_Demo.mp4` |
| Presenter and backup | Team | |
| Recording and social media permission | Team | |

## Demo video

| Requirement | Status | Evidence |
|---|---|---|
| MP4, 1080p | Done | ffprobe: H.264 1920x1080, 30 fps, AAC 48 kHz stereo, English caption track; 212 MB; loudness -16.0 LUFS, true peak -1.4 dBTP |
| 3 to 5 minutes | Done | 4:25 (265.1 s) |
| File name `HackstreetBoys_PiecesOfHome_Demo.mp4` | Done | `video/out/` |
| Clear English voice-over | Done | A female synthetic voice (Chatterbox) with a mood per line (hushed, curious, excited, proud); every line transcribed back and checked against the script |
| English subtitles | Done | Burned into the picture, plus an English caption track in the MP4 and a `.en.srt` file |
| Part 1, intro of team and project | Done | 0:00 to 0:18 |
| Part 2, the problem | Done | 0:18 to 0:57 |
| Part 3, the solution | Done | 0:57 to 1:27 |
| Part 4, live demo of the real app with voice-over, about 1.5 to 2 minutes | Done, 1:55 | 1:27 to 3:22, real game in Chrome, including Dad's journey chapter picker |
| Part 5, features | Done | 3:22 to 3:39, then NASA data 3:39 to 4:03 |
| Part 6, impact | Done | 4:03 to the end (4:25) |
| Show only working features | Done | Every shot is the live game; nothing mocked up |
| Label in-development, simulated or mock-up parts | Done | Nothing is simulated: every demo shot is the real game, labeled "Live demo, real gameplay" on the "Let's play!" card; dioramas say "Model, not to scale" in the game |
| Explain how NASA data is used | Done | Problem part (NASA photos with credits), NASA data part, description, datasets list |
| No copyrighted music or footage | Done | Score made in code; sound effects are the game's own (code plus CC0 samples); footage is our game; NASA images are public and credited |
| No passwords, keys, credentials or personal info on screen | Done | Checked frame by frame: names only, no emails or numbers; no key on screen |
| AI disclosure | Done | End card line "Built with AI tools; see AI_USE.md"; MP4 comment and description metadata; [AI_USE.md](../../../AI_USE.md) (the per-frame tag was dropped at the team's request) |

## Rules

| Requirement | Status | Evidence |
|---|---|---|
| GitHub repo public | Done | https://github.com/Vurios/piecesofhome |
| AI allowed with disclosure | Done | [AI_USE.md](../../../AI_USE.md), linked from the README |
| No NASA logos or branding; nothing implying endorsement | Done | No insignia, logotype, seal, flags or mission patches in the game, video or slides; "NASA did not make, sponsor or endorse this project" in the README, video end card and slides |
| List every outside resource | Done | [CREDITS.md](../../../CREDITS.md), [src/data/credits.json](../../../src/data/credits.json), [datasets.md](datasets.md) |

## Judging rubric (10 points each)

| Criterion | Where we show it |
|---|---|
| Impact | Free, in the browser, no install or account; kid-safe co-op; printable Field Guide; ready for classrooms (slides 5 and 6) |
| Creativity | Dad's letters to the machines, dioramas under glass, Milo rebuilt one engineering idea at a time; a score and look made for the game |
| Validity | 103 checked facts, each with a source link; the build fails on an unsourced fact; exact NASA credits; date-aware Voyager 1 light time from JPL Horizons; models labeled |
| Relevance | Real machines left on the Moon and Mars (and Voyager 1), real NASA images, coordinates, ephemeris and recordings |
| Presentation | The loader-to-title sequence, a 4:21 video with captions and the six parts, slides in the game's style |
