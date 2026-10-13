# Soundscapes

Live at https://denyeh.com/soundscapes/. Files: `index.html`, `soundscapes.css`, `soundscapes.js`, `tracks.json`, `audio/<id>.mp3` (short previews), `covers/<id>.jpg`.

Hybrid page: short previews are hosted here; full tracks live on streaming stores via `links`.

## tracks.json schema

A JSON array, newest first by `added`. Each track:

| field | type | notes |
|---|---|---|
| `id` | string | unique, URL-safe |
| `title` | string | |
| `scene` | string | one-line subtitle |
| `use` | string[] | e.g. `sleep`, `focus`, `calm`, `meditate`, `nature` |
| `system` | string | `binaural` (headphones) or `stereo` |
| `length` | number | full-track seconds |
| `previewLength` | number | preview seconds (label falls back to audio duration) |
| `file` | string | absolute URL of the preview MP3 (`https://denyeh.com/soundscapes/audio/<id>.mp3`) |
| `cover` | string | absolute URL of the square cover |
| `description` | string | |
| `artist` | string | `Voice Without Words` |
| `added` | string | `YYYY-MM-DD` |
| `aiGenerated` | boolean | always `true` |
| `links` | object | `{spotify, apple, youtubeMusic, amazon}`; empty shows "Coming soon to streaming" |

Artist follow links (hero) are in `ARTIST_LINKS` at the top of `soundscapes.js`; empty ones are hidden.

The background layer (pink, brown, rain) is generated in the browser with Web Audio. No tracking scripts.
