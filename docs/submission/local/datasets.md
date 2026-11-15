# NASA data and resources used

Every item opens without a login. Checked on November 15, 2026 with a plain web request: all returned HTTP 200, except JPL news pages, which refuse scripted requests (HTTP 403) but open normally in a browser. The full list of every file, with its license, is in [CREDITS.md](../../../CREDITS.md) and [src/data/credits.json](../../../src/data/credits.json). Every fact a player can read is in [src/data/facts.json](../../../src/data/facts.json) with its own source link.

## For the form ("NASA datasets used")

Paste this list:

1. NASA Image and Video Library (images.nasa.gov): Apollo 11, 12, 14 and 15 photos on the true story cards and in Dad's notebook, and Sojourner, Viking 1, Spirit and InSight images on the archive cards.
2. NASA Photojournal (photojournal.jpl.nasa.gov): Opportunity, Ingenuity, Voyager and Apollo 15 orbit images.
3. Lunar Reconnaissance Orbiter Camera, NASA/GSFC/Arizona State University (lroc.asu.edu): orbit views of the Apollo 11, 12 and 15 sites today.
4. NASA Scientific Visualization Studio, CGI Moon Kit (svs.gsfc.nasa.gov/4720): the Moon globe's color map.
5. Mars Viking Colorized Global Mosaic (MDIM 2.1), NASA Ames and USGS Astrogeology (astrogeology.usgs.gov): the Mars globe's map.
6. NASA NSSDCA landing site coordinates and spacecraft pages (nssdc.gsfc.nasa.gov): the pins on Dad's globes and mission facts.
7. NASA JPL Horizons System (ssd.jpl.nasa.gov/horizons): Voyager 1's distance, light time and place in the sky, day by day.
8. Yale Bright Star Catalog, hosted by NASA HEASARC (heasarc.gsfc.nasa.gov): the stars on Dad's star map.
9. NASA mission recordings: Mars wind and Ingenuity's flight hum recorded by Perseverance's SuperCam microphone, Voyager 1 plasma waves, and Apollo 11's landing call.

## Details

| Resource | Source | Full link | How the game uses it |
|---|---|---|---|
| NASA Image and Video Library | NASA | https://images.nasa.gov/ | Photos AS11-40-5948 (Buzz Aldrin by the Apollo 11 experiments), AS15-85-11451 (the Moon buggy), AS12-48-7136 (Surveyor 3), AS14-67-9386 (Apollo 14 mirrors), and PIA01122, PIA00381, PIA07371, PIA25287 for the archive cards. Each card shows the exact credit line. |
| NASA Photojournal | NASA/JPL-Caltech | https://photojournal.jpl.nasa.gov/ | PIA22928 (looking back from Opportunity), PIA05273 ("blueberries"), PIA24584 (Ingenuity's first image from the air), PIA26237 (Ingenuity at Valinor Hills), PIA17035 (the Golden Record), PIA13058 (Apollo 15 site from orbit). Files are served from https://assets.science.nasa.gov/. |
| Lunar Reconnaissance Orbiter Camera | NASA/GSFC/Arizona State University | https://www.lroc.asu.edu/ | "Then and Now" views of the Apollo 11, 12 and 15 sites in Dad's notebook. |
| CGI Moon Kit (lroc_color_poles_1k) | NASA's Scientific Visualization Studio | https://svs.gsfc.nasa.gov/4720/ | Painted color map on the Moon globe in Dad's workshop. |
| Mars Viking Colorized Global Mosaic (MDIM 2.1) | NASA Ames / USGS Astrogeology Science Center | https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m | Painted color map on the Mars globe. |
| Apollo landing site coordinates | NASA NSSDCA | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html | Latitude and longitude of the pins on the Moon globe (fact IDs a11-site, a15-site, a12-site, a14-lrrr-site). Mars pins use NSSDCA and mission pages (opp-site, spi-site, vik1-site, ing-site, ins-site, soj-site). |
| JPL Horizons System | NASA JPL Solar System Dynamics | https://ssd.jpl.nasa.gov/horizons/ | A daily table for Voyager 1 (src/data/voyager1.json, November 2026 to the end of 2028): its light time and distance, and its place in the sky on Dad's star map. The finale shows how long Dad's letter would take to reach Voyager 1 on the day you play. |
| Yale Bright Star Catalog, 5th revised edition | Hoffleit and Warren (1991), hosted by NASA HEASARC | https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html | Star positions on Dad's star map (src/data/stars-voyager.json). |
| Perseverance SuperCam: wind on Mars | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero | https://www.nasa.gov/wp-content/uploads/2024/05/scam-mic-sol004-run001.wav | The real Mars wind, played in the Mars worlds with a caption (fact rec-mars-wind). |
| Perseverance SuperCam: Ingenuity in flight | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero | https://www.nasa.gov/wp-content/uploads/2024/05/jpl-20210506-listen-to-nasas-ingenuity-helicopter-as-it-flies-on-mars.wav | Ingenuity's real hum in Valinor Hills, filtered and made louder by the mission team (fact rec-ingenuity-hum). |
| Voyager plasma waves (PIA17045) | NASA/JPL-Caltech/University of Iowa | https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia17/pia17045/PIA17045_20130906-640.mp4 | The sound of interstellar space in the finale (fact rec-voyager-plasma). |
| Apollo 11 landing audio | NASA | https://nssdc.gsfc.nasa.gov/planetary/lunar/a11landing.aiff | "Tranquility Base here. The Eagle has landed." in Chapter 1 (fact rec-apollo11-landed). |
| NASA and JPL mission pages | NASA, JPL, NSSDCA | listed per fact in src/data/facts.json | 103 checked facts, each with its source title and link, for every number, date and claim in the game. Examples: https://science.nasa.gov/mission/mer-opportunity/ and https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/ |

## Other outside resources (not NASA)

- Fonts under the SIL Open Font License: Kalam, Atkinson Hyperlegible Next, Zilla Slab, Fraunces, OpenDyslexic.
- Instrument samples: Versilian Community Sample Library (CC0). Sound effects: Kenney (CC0).
- Libraries: Three.js, Svelte, PartyServer and partysocket (MIT); Cloudflare Workers free tier for hosting.
- Video kit only: HyperFrames (video renderer), GSAP (animation library, free GSAP license), Playwright (Apache-2.0), FFmpeg (LGPL/GPL tools, used as a program), Chatterbox text-to-speech (MIT) for the narration (Kokoro-82M, Apache-2.0, for the first cut).

NASA did not make, sponsor or endorse this project. No NASA insignia, logotype or seal is used.
