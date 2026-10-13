# Soundscapes

Live at https://denyeh.com/soundscapes/. Files: `index.html`, `soundscapes.css`, `soundscapes.js`, `tracks.json`.

## tracks.json schema

A JSON array (starts as `[]`). Each track:

| field | type | notes |
|---|---|---|
| `id` | string | unique, URL-safe (used in `?mix=id:70,brown:30`; `pink` and `brown` are reserved) |
| `title` | string | |
| `scene` | string | one-line scene description |
| `use` | string[] | any of `sleep`, `focus`, `calm`, `meditate`, `energy`, `nature`, `noise` |
| `system` | string | `binaural` (headphones), `stereo` (speakers), `5.1` (download only, no play button) |
| `noMusic` | boolean | true if there is no musical content |
| `length` | number | seconds |
| `file` | string | absolute URL of the audio. Host must send `Access-Control-Allow-Origin` for mixing (Web Audio) |
| `cover` | string | image URL |
| `description` | string | |
| `added` | string | `YYYY-MM-DD`; "New this week" = 7 days, "New" tag = 14 days |
| `aiGenerated` | boolean | always `true` |

Example:

```json
[{"id":"rain-cabin","title":"Rain on the Cabin","scene":"Steady rain on a tin roof, woodstove ticking.","use":["sleep","nature"],"system":"stereo","noMusic":true,"length":1800,"file":"https://audio.example.com/rain-cabin.mp3","cover":"https://audio.example.com/rain-cabin.jpg","description":"Thirty minutes of rain.","added":"2026-10-20","aiGenerated":true}]
```

Encoding: 128–160 kbps MP3 (or AAC .m4a), 44.1 kHz stereo; 30 min ≈ 29–36 MB.
