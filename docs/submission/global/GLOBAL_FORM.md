# NASA Space Apps 2026: global project page, paste-ready

Fields are in the order they appear on our project page. Counts are checked by `python -I video/tools/build-global-form.py`, which also opened every link (status codes at the bottom). No em or en dashes anywhere.

## 1. Project Name

```text
Pieces of Home
```

## 2. Summary (required) · 180 words, 986 characters (limit 1,500; 50 to 200 words suggested)

```text
Pieces of Home is a free, cozy 3D browser game that tells the stories of the machines NASA left on the Moon, on Mars and far out in space. Remi finds the unsent letters of their late dad, who loved these machines, and delivers them inside his handmade models of real landing sites: Apollo 11's mirrors at Tranquility Base, the Apollo 15 Moon buggy, Surveyor 3, Opportunity, Ingenuity, and finally Voyager 1. At each site, players learn the true story of the hardware and play with the science that made it work, like bouncing light off corner mirrors, then rebuild Dad's robot, Milo, one part at a time. Every number in the game comes from a checked list of facts, each with a NASA, JPL or NSSDCA source link, and real NASA photos carry their exact credits. It plays solo or with up to three friends in kid-safe co-op with no chat, right in the browser. These machines are not junk: some still work, and every one of them carries a story that can spark the next generation of explorers.
```

## 3. Project Demonstration (required): public video link, 30 seconds or less

Use one of these (all public, no login):

- **Recommended:** the trailer page on our own site, plays in the browser: https://piecesofhome.pages.dev/trailer/
- The MP4 on GitHub Releases: https://github.com/Vurios/piecesofhome/releases/latest/download/HackstreetBoys_PiecesOfHome_30s.mp4
- Or a YouTube link, if the team uploads it (see MY_TASKS.md).

## 4. Project (required): final project link

```text
https://piecesofhome.pages.dev
```

The code is at https://github.com/Vurios/piecesofhome (named inside Project Details).

## 5. Project Details (required, rich text) · 771 words, 4685 characters

Paste into the rich-text box. Bold headings and bullet lists paste as formatting from most editors; if they paste as plain text, make the bold lines headings by hand.

**What it does**

Pieces of Home turns NASA's left-behind hardware into a story players want to finish. Remi, a young player character, returns to their late dad's workshop and finds glass domes, each holding a model of a real landing site, and letters Dad wrote to the machines there but never sent. Players step into each model, deliver the letter, read the machine's true story, and play with the engineering idea behind it:

- Tranquility Base (Apollo 11): send a light from Earth to the corner-cube mirrors and catch it coming back. Scientists still bounce lasers off this panel today.
- Hadley-Apennine (Apollo 15): the mesh wheels of the Moon buggy.
- Meridiani Planum (Opportunity): solar power and the Martian wind that cleaned its panels. Planned for 90 Martian days, it kept going for more than 14 years.
- Valinor Hills (Ingenuity): flying in very thin air. Planned for up to five test flights, it flew 72 times.
- Ocean of Storms (bonus): Surveyor 3 and the Apollo 12 visit.
- Finale: Dad's backyard dish points at Voyager 1, which becomes the first human-made object one light-day from Earth on November 18, 2026; the game shows how long Dad's letter would take to reach it on the day you play.

Each idea rebuilds a part of Dad's robot, Milo, and fills a page of Dad's notebook.

**How it works**

- Built with TypeScript, Three.js (3D worlds with a hand-drawn toon look) and Svelte 5 (notebook, letters, map and menus), served by Cloudflare Pages, with a Cloudflare Worker for co-op.
- Co-op for 1 to 4 players uses one Cloudflare Durable Object per private room code. There is no text or voice chat, no usernames and no tracking; players talk with emotes and a few kind preset phrases.
- Music, voices and most sound effects are made in code with the Web Audio API, plus CC0 instrument and sound samples.
- Accuracy is built into the code: every number, date and claim a player can read comes from one facts file (103 checked facts), and each fact has its NASA, JPL or NSSDCA source link. The build fails if game text uses a fact that is missing, unsourced or not yet verified. Models are labeled "Model, not to scale".

**How NASA data is used**

- Real NASA photos (NASA Image and Video Library, Photojournal, LROC) on the true story cards and in Dad's notebook, each with its exact credit.
- The CGI Moon Kit (NASA SVS) and the Viking Mars mosaic (NASA Ames, USGS) paint Dad's globes; the pins sit at real landing coordinates from NASA NSSDCA.
- A daily JPL Horizons table follows Voyager 1's distance, light time and place in the sky, so the finale is right on the day you play.
- Real mission recordings: Mars wind and Ingenuity's hum from Perseverance, Voyager plasma waves, Apollo 11's landing call.

**Benefits and intended impact**

- Players aged 10 and up meet the hardware as stories, not junk, and learn the science by doing it.
- Free, in any modern desktop browser, no install or account; ready for classrooms today, with a printable Field Guide that lists every fact and source.
- Imagine every classroom meeting these machines as friends. Next steps we would like to take: play-tests with students and teachers, more machines, and phone support.

**Tools, languages, hardware and software**

TypeScript, Svelte 5, Three.js, Vite, Cloudflare Pages, Workers and Durable Objects (PartyServer, partysocket), Web Audio API, Vitest, Playwright with axe-core, Python and FFmpeg for the video, HyperFrames and GSAP for the video edit. Made on ordinary laptops; it runs on a mid-range laptop in the browser. AI tools: Claude Code (coding assistant) and an open text-to-speech model (Chatterbox) for the video narration, disclosed in AI_USE.md.

**What makes it creative**

A family story carries the science: letters to machines, dioramas under glass, and a robot rebuilt one engineering idea at a time. The worlds are tiny planets you can walk around, the art is drawn in code in one warm, hand-made style, and the music adds an instrument for each friend in the room.

**Factors we considered**

Accuracy (sourced facts, exact credits, date-aware Voyager data, models labeled), kid safety and privacy (no chat, no accounts, no analytics), accessibility (captions for every line, text size, a dyslexia-friendly font, high contrast, reduced motion, keyboard, mouse and gamepad), licensing (only NASA media, CC0 and open-licensed fonts and libraries, all listed in CREDITS.md), performance on ordinary laptops, a gentle treatment of loss, and honest AI disclosure.

Play: https://piecesofhome.pages.dev · Code: https://github.com/Vurios/piecesofhome · 30-second video: https://piecesofhome.pages.dev/trailer/

NASA did not make, sponsor or endorse this project.

## 6. Use of Super Intelligence (required; data collection only)

Tick every option that matches the list below (option names on the form may differ slightly):

- **Code:** Yes: an AI coding assistant (Claude Code) wrote most of the code under the team's direction.
- **Text:** Yes: drafts of in-game text, docs and these form answers, edited and approved by the team.
- **Audio:** Yes: the video narration is a synthetic voice (Chatterbox). The game's music and sounds are made in code, plus CC0 recorded samples. The game uses no AI audio.
- **Video:** Yes: the demo videos were edited with code written by the AI assistant and carry a 'Made with AI tools' mark.
- **Data / research:** Yes, if offered: the AI assistant helped research facts; every fact used links to its NASA, JPL or NSSDCA source.
- **Images:** No AI image generator was used. Real photos are NASA's, with credits; illustrations are drawn in code.

How we follow the rules: the AI voice and code are acknowledged in this form, in AI_USE.md, the video description and the MP4 metadata; nothing generated uses NASA logos, flags or mission identifiers.

## 7. NASA Data (required for Global Award) · 28 rows

Add one row per line: Link Text, then Link URL.

| # | Link Text | Link URL |
|---|---|---|
| 1 | NASA Image and Video Library | https://images.nasa.gov/ |
| 2 | NASA Photojournal | https://photojournal.jpl.nasa.gov/ |
| 3 | Lunar Reconnaissance Orbiter Camera (NASA/GSFC/ASU) | https://www.lroc.asu.edu/ |
| 4 | NASA SVS: CGI Moon Kit | https://svs.gsfc.nasa.gov/4720/ |
| 5 | Mars Viking Colorized Global Mosaic (NASA Ames, USGS) | https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m |
| 6 | NASA NSSDCA: Apollo landing site coordinates | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html |
| 7 | NASA JPL Horizons System (Voyager 1 ephemeris) | https://ssd.jpl.nasa.gov/horizons/ |
| 8 | Yale Bright Star Catalog (NASA HEASARC) | https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html |
| 9 | NASA Sounds from Beyond (Perseverance Mars wind, Ingenuity hum) | https://www.nasa.gov/sounds-from-beyond/ |
| 10 | NASA NSSDCA: Apollo 11 landing audio | https://nssdc.gsfc.nasa.gov/planetary/sound/index.html |
| 11 | Astronaut Edwin Aldrin after deployment of EASEP on surface of moon (AS11-40-5948) | https://images.nasa.gov/details/as11-40-5948 |
| 12 | A Stark Beauty All Its Own (LROC M175124932R) | https://www.lroc.asu.edu/images/484 |
| 13 | The Apollo 12 and Surveyor 3 landing site (Lunar Reconnaissance Orbiter, 2010) | https://science.nasa.gov/solar-system/moon/footpads-and-footprints-humans-and-machine-meet-on-the-moon/ |
| 14 | Astronaut David Scott on slope of Hadley Delta during Apollo 15 EVA (AS15-85-11451) | https://images.nasa.gov/details/as15-85-11451 |
| 15 | Retracing the Steps of Apollo 15 (PIA13058) | https://science.nasa.gov/photojournal/retracing-the-steps-of-apollo-15/ |
| 16 | Looking Back on a Golden Opportunity (PIA22928) | https://science.nasa.gov/photojournal/looking-back-on-a-golden-opportunity/ |
| 17 | "Berries" on the Ground (PIA05273) | https://science.nasa.gov/photojournal/berries-on-the-ground/ |
| 18 | Ingenuity's First Black-and-White Image From the Air (PIA24584) | https://science.nasa.gov/photojournal/ingenuitys-first-black-and-white-image-from-the-air/ |
| 19 | Ingenuity at 'Valinor Hills' (PIA26237, detail) | https://science.nasa.gov/photojournal/ingenuity-at-valinor-hills/ |
| 20 | Mementos of Earth (PIA17035) | https://science.nasa.gov/photojournal/mementos-of-earth/ |
| 21 | Voyager Captures Sounds of Interstellar Space (PIA17045) | https://science.nasa.gov/photojournal/voyager-captures-sounds-of-interstellar-space |
| 22 | Astronaut Charles Conrad Jr. examines the Surveyor 3 spacecraft (AS12-48-7136) | https://images.nasa.gov/details/as12-48-7136 |
| 23 | Sojourner Rover Near The Dice (PIA01122) | https://science.nasa.gov/photojournal/sojourner-rover-near-the-dice/ |
| 24 | First Photograph Taken on Mars Surface (PIA00381) | https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/ |
| 25 | Spirit Self-Portrait, Sols 329-330 (PIA07371) | https://science.nasa.gov/photojournal/spirit-self-portrait-sols-329-330/ |
| 26 | InSight's Final Selfie (PIA25287) | https://science.nasa.gov/photojournal/insights-final-selfie/ |
| 27 | Close-up of the Apollo 14 laser ranging retroreflector (AS14-67-9386) | https://images.nasa.gov/details/as14-67-09386 |
| 28 | Voyager 1: What Is a Light-Day (NASA Science) | https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/ |

Optional, for completeness: every fact in the game links to its own NASA, JPL or NSSDCA page (49 pages, listed in src/data/facts.json and at the end of this file).

## 8. Space Agency Partner & Other Data · 35 rows

No space agency partner data is used. Other resources and tools, each with its license:

| # | Link Text | Link URL | License |
|---|---|---|---|
| 1 | three | https://github.com/mrdoob/three.js | MIT |
| 2 | svelte | https://github.com/sveltejs/svelte | MIT |
| 3 | partyserver | https://github.com/cloudflare/partykit/tree/main/packages/partyserver | ISC |
| 4 | partysocket | https://github.com/cloudflare/partykit/tree/main/packages/partysocket | MIT |
| 5 | roughjs | https://github.com/rough-stuff/rough | MIT |
| 6 | perfect-freehand | https://github.com/steveruizok/perfect-freehand | MIT |
| 7 | Kalam | https://github.com/itfoundry/kalam | SIL Open Font License 1.1 |
| 8 | Fraunces | https://github.com/undercasetype/Fraunces | SIL Open Font License 1.1 |
| 9 | Atkinson Hyperlegible Next | https://www.brailleinstitute.org/freefont/ | SIL Open Font License 1.1 |
| 10 | Zilla Slab | https://github.com/mozilla/zilla-slab | SIL Open Font License 1.1 |
| 11 | OpenDyslexic | https://opendyslexic.org | SIL Open Font License 1.1 |
| 12 | @gltf-transform/core, functions, extensions | https://github.com/donmccurdy/glTF-Transform | MIT |
| 13 | meshoptimizer | https://github.com/zeux/meshoptimizer | MIT |
| 14 | draco3dgltf | https://github.com/google/draco | Apache-2.0 |
| 15 | @fontsource packages | https://github.com/fontsource/fontsource | MIT (packaging); fonts SIL OFL 1.1 |
| 16 | axe-core, @axe-core/playwright | https://github.com/dequelabs/axe-core | MPL-2.0 |
| 17 | HyperFrames CLI | https://github.com/heygen-com/hyperframes | Apache-2.0 |
| 18 | GSAP | https://gsap.com/standard-license/ | GSAP standard no-charge license |
| 19 | Chatterbox TTS 0.1.4 (Resemble AI), PyTorch | https://github.com/resemble-ai/chatterbox | MIT (Chatterbox, Perth); BSD-3-Clause (PyTorch) |
| 20 | python-docx | https://github.com/python-openxml/python-docx | MIT |
| 21 | Kokoro-82M v1.0 (ONNX), kokoro-js | https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX | Apache-2.0 |
| 22 | FFmpeg, ffprobe | https://ffmpeg.org | LGPL/GPL (used as a program) |
| 23 | NumPy | https://numpy.org | BSD-3-Clause |
| 24 | python-pptx | https://github.com/scanny/python-pptx | MIT |
| 25 | Kenney Impact Sounds (sound effects) | https://kenney.nl/assets/impact-sounds | CC0 |
| 26 | Kenney RPG Audio (sound effects) | https://kenney.nl/assets/rpg-audio | CC0 |
| 27 | Kenney Interface Sounds (sound effects) | https://kenney.nl/assets/interface-sounds | CC0 |
| 28 | Versilian Community Sample Library (instrument samples) | https://github.com/sgossner/VCSL | CC0 |
| 29 | Claude Code (AI coding assistant, Anthropic) | https://www.anthropic.com/claude-code | Commercial tool (disclosed in AI_USE.md) |
| 30 | Chatterbox TTS model weights (Resemble AI) | https://huggingface.co/ResembleAI/chatterbox | MIT |
| 31 | Vite | https://github.com/vitejs/vite | MIT |
| 32 | TypeScript | https://github.com/microsoft/TypeScript | Apache-2.0 |
| 33 | Vitest | https://github.com/vitest-dev/vitest | MIT |
| 34 | Playwright | https://github.com/microsoft/playwright | Apache-2.0 |
| 35 | Cloudflare Workers and Wrangler (hosting, free tier) | https://github.com/cloudflare/workers-sdk | MIT or Apache-2.0 |

## 9. Checkboxes

Terms and original work: the team ticks these on the form.

## Link check

Each link was opened with a plain web request (no login). 200 means it opened; some NASA and JPL pages refuse scripted requests (403) but open normally in a browser.

- 200: https://images.nasa.gov/
- 200: https://photojournal.jpl.nasa.gov/
- 200: https://www.lroc.asu.edu/
- 200: https://svs.gsfc.nasa.gov/4720/
- 200: https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m
- 200: https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html
- 200: https://ssd.jpl.nasa.gov/horizons/
- 200: https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html
- 200: https://www.nasa.gov/sounds-from-beyond/
- 200: https://nssdc.gsfc.nasa.gov/planetary/sound/index.html
- 200: https://images.nasa.gov/details/as11-40-5948
- 200: https://www.lroc.asu.edu/images/484
- 200: https://science.nasa.gov/solar-system/moon/footpads-and-footprints-humans-and-machine-meet-on-the-moon/
- 200: https://images.nasa.gov/details/as15-85-11451
- 200: https://science.nasa.gov/photojournal/retracing-the-steps-of-apollo-15/
- 200: https://science.nasa.gov/photojournal/looking-back-on-a-golden-opportunity/
- 200: https://science.nasa.gov/photojournal/berries-on-the-ground/
- 200: https://science.nasa.gov/photojournal/ingenuitys-first-black-and-white-image-from-the-air/
- 200: https://science.nasa.gov/photojournal/ingenuity-at-valinor-hills/
- 200: https://science.nasa.gov/photojournal/mementos-of-earth/
- 200: https://science.nasa.gov/photojournal/voyager-captures-sounds-of-interstellar-space
- 200: https://images.nasa.gov/details/as12-48-7136
- 200: https://science.nasa.gov/photojournal/sojourner-rover-near-the-dice/
- 200: https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/
- 200: https://science.nasa.gov/photojournal/spirit-self-portrait-sols-329-330/
- 200: https://science.nasa.gov/photojournal/insights-final-selfie/
- 200: https://images.nasa.gov/details/as14-67-09386
- 200: https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/
- 200: https://github.com/mrdoob/three.js
- 200: https://github.com/sveltejs/svelte
- 200: https://github.com/cloudflare/partykit/tree/main/packages/partyserver
- 200: https://github.com/cloudflare/partykit/tree/main/packages/partysocket
- 200: https://github.com/rough-stuff/rough
- 200: https://github.com/steveruizok/perfect-freehand
- 200: https://github.com/itfoundry/kalam
- 200: https://github.com/undercasetype/Fraunces
- 200: https://www.brailleinstitute.org/freefont/
- 200: https://github.com/mozilla/zilla-slab
- 200: https://opendyslexic.org
- 200: https://github.com/donmccurdy/glTF-Transform
- 200: https://github.com/zeux/meshoptimizer
- 200: https://github.com/google/draco
- 200: https://github.com/fontsource/fontsource
- 200: https://github.com/dequelabs/axe-core
- 200: https://github.com/heygen-com/hyperframes
- 200: https://gsap.com/standard-license/
- 200: https://github.com/resemble-ai/chatterbox
- 200: https://github.com/python-openxml/python-docx
- 200: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- 200: https://ffmpeg.org
- 200: https://numpy.org
- 200: https://github.com/scanny/python-pptx
- 200: https://kenney.nl/assets/impact-sounds
- 200: https://kenney.nl/assets/rpg-audio
- 200: https://kenney.nl/assets/interface-sounds
- 200: https://github.com/sgossner/VCSL
- 200: https://www.anthropic.com/claude-code
- 200: https://huggingface.co/ResembleAI/chatterbox
- 200: https://github.com/vitejs/vite
- 200: https://github.com/microsoft/TypeScript
- 200: https://github.com/vitest-dev/vitest
- 200: https://github.com/microsoft/playwright
- 200: https://github.com/cloudflare/workers-sdk
- 200: https://piecesofhome.pages.dev
- 200: https://github.com/Vurios/piecesofhome
- 200: https://piecesofhome.pages.dev/trailer/

## Appendix: every fact's source page

- https://mars.nasa.gov/mmgis-maps/M20/Layers/json/m20_heli_waypoints.json
- https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1967-035A
- https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C
- https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1971-063C
- https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C
- https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1996-068A
- https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2003-027A
- https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2003-032A
- https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2018-042A
- https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html
- https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html
- https://science.nasa.gov/mission/mars-pathfinder/
- https://science.nasa.gov/mission/mer-opportunity/
- https://science.nasa.gov/mission/mer-spirit/
- https://science.nasa.gov/mission/surveyor-3/
- https://science.nasa.gov/mission/viking-1/
- https://science.nasa.gov/mission/voyager/golden-record-contents/
- https://science.nasa.gov/mission/voyager/voyager-1/
- https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/
- https://science.nasa.gov/photojournal/retracing-the-steps-of-apollo-15
- https://science.nasa.gov/photojournal/sojourner-rover-near-the-dice/
- https://science.nasa.gov/photojournal/voyager-captures-sounds-of-interstellar-space/
- https://science.nasa.gov/resource/apollo-11-seismic-experiment/
- https://science.nasa.gov/resource/pathfinder-sol-8/
- https://science.nasa.gov/solar-system/moon/footpads-and-footprints-humans-and-machine-meet-on-the-moon/
- https://ssd.jpl.nasa.gov/horizons/
- https://www.jpl.nasa.gov/images/pia23968-mars-helicopter-base-station-on-perseverance-rover/
- https://www.jpl.nasa.gov/images/pia24434-the-wright-brothers/
- https://www.jpl.nasa.gov/news/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends
- https://www.jpl.nasa.gov/news/apollo-11-experiment-still-going-strong-after-35-years/
- https://www.jpl.nasa.gov/news/earth-moon-system
- https://www.jpl.nasa.gov/news/nasa-spacecraft-embarks-on-historic-journey-into-interstellar-space/
- https://www.jpl.nasa.gov/news/nasas-curiosity-rover-views-serene-sundown-on-mars/
- https://www.jpl.nasa.gov/news/nasas-ingenuity-mars-helicopter-team-says-goodbye-for-now
- https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/
- https://www.jpl.nasa.gov/news/nasas-perseverance-captures-video-audio-of-fourth-ingenuity-flight/
- https://www.jpl.nasa.gov/news/new-look-at-2004s-martian-hole-in-one-site/
- https://www.jpl.nasa.gov/news/news.php?feature=4112
- https://www.jpl.nasa.gov/news/perseverance-rovers-supercam-science-instrument-delivers-first-results/
- https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/quick_facts/
- https://www.jpl.nasa.gov/news/six-things-to-know-about-nasas-opportunity-mars-rover/
- https://www.jpl.nasa.gov/news/the-apollo-experiment-that-keeps-on-giving/
- https://www.nasa.gov/history/55-years-ago-apollo-12-makes-a-pinpoint-landing-on-the-moon/
- https://www.nasa.gov/history/july-20-1969-one-giant-leap-for-mankind/
- https://www.nasa.gov/image-article/this-week-nasa-history-apollo-15-astronauts-deploy-first-lunar-roving-vehicle-july-31-1971/
- https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/
- https://www.nasa.gov/missions/laser-beams-reflected-between-earth-and-moon-boost-science/
- https://www.nasa.gov/news-release/nasas-ingenuity-mars-helicopter-succeeds-in-historic-first-flight/
- https://www.nasa.gov/wp-content/uploads/static/history/SP-4214/ch11-2.html
