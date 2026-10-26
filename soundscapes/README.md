# Soundscapes

Live at https://denyeh.com/soundscapes/. Files: `index.html`, `soundscapes.css`, `soundscapes.js`, `tracks.json`, `audio/<id>.mp3` (short previews), `covers/<id>.jpg`.

Hybrid page: short previews are hosted here; full tracks live on streaming stores via `links`. A `both` track comes in 5.1 (speakers) and binaural (headphones only). Only the binaural preview is on this page; the full files are not linked. An empty `links` object shows no "Listen on" line.

## tracks.json schema

A JSON array, newest first by `added`. Each track:

| field | type | notes |
|---|---|---|
| `id` | string | unique, URL-safe |
| `title` | string | |
| `scene` | string | one-line subtitle |
| `use` | string[] | e.g. `sleep`, `focus`, `calm`, `meditate`, `nature`, `study`, `create`, `breathe`. The use row and the system row narrow together. |
| `system` | string | `binaural` (headphones), `stereo`, or `both` (5.1 speakers and binaural headphones). `both` appears under the Binaural filter. There is no 5.1 filter. |
| `formats` | object | optional. Keys `5.1` and `binaural`, each with `listen` and `encoding`. Full audio files are not hosted here and are not linked. |
| `previewSource` | string | optional. `binaural` means the on-page preview is the headphone mix. `stereo` means a stereo downmix of a speakers mix, noted on the card as "Preview: stereo downmix." A 5.1-only track uses `system: "stereo"` and a `formats` object with `5.1` only, so it stays under Stereo and out of Binaural. |
| `length` | number | full-track seconds |
| `previewLength` | number | preview seconds (label falls back to audio duration) |
| `file` | string | absolute URL of the preview MP3 (`https://denyeh.com/soundscapes/audio/<id>.mp3`) |
| `cover` | string | absolute URL of the square cover |
| `description` | string | full text on the card when it says more than `scene`. Long copy sits in an open description disclosure. |
| `credit` | string | optional. A short license or source line, shown in small text inside the description disclosure. |
| `artist` | string | `Voice Without Words` |
| `added` | string | `YYYY-MM-DD` |
| `aiGenerated` | boolean | always `true` |
| `links` | object | `{spotify, apple, youtubeMusic, amazon}`; each present URL is a text link on one "Listen on" line. Empty shows nothing. |

Artist follow links (hero) are in `ARTIST_LINKS` at the top of `soundscapes.js`; empty ones are hidden.

The background layer (pink, brown, rain) is generated in the browser with Web Audio. No tracking scripts.
