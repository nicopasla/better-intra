# Better Intra — Campus Data

## How to add your campus

1. Find your campus ID from the 42 API (`/v2/users/:id/campus` — the `id` field)
2. Create a folder named after your campus ID (e.g., `42/`)
3. Add a `clusters.json` file with seating data (see format below)
4. Add an `event_types.json` file with event filter keywords (see format below)
5. Update `campuses.json` to include your campus
6. Submit a pull request

## clusters.json format

```json
{
  "clusters": [
    { "id": "20", "name": "shi" },
    { "id": "21", "name": "fu" }
  ],
  "definitions": {
    "shi": {
      "rows": [
        { "range": "r1-r5", "pos": [1, 3, 5], "dir": "UP" }
      ],
      "manual": [
        { "row": "r6", "pos": [1, 2, 3], "dir": "DOWN" }
      ],
      "overrides": {
        "r1-p2": "LEFT"
      }
    }
  }
}
```

### Fields

- `clusters[]` — list of clusters on this campus
  - `id` — cluster ID from 42 network
  - `name` — short lowercase name (used for seat matching)

- `definitions` — map of cluster name → seating layout
  - `rows[]` — range-based seating
    - `range` — row range like `"r2-r11"`
    - `pos` — position numbers
    - `dir` — screen direction: `"UP"` | `"DOWN"` | `"LEFT"` | `"RIGHT"` | `"NONE"`
  - `manual[]` — per-row seating without range
    - `row` — row name like `"r1"` or `"c1"`
    - `pos` — position numbers
    - `dir` — same as above
  - `overrides` — per-seat direction overrides
    - Key format: `"{row}-p{pos}"` (e.g., `"r1-p2"`)
    - Value: same direction as above

## event_types.json format

```json
{
  "event_types": {
    "exam": { "display": "Exam", "keywords": ["exam"] },
    "conference": { "display": "Conference", "keywords": ["conference", "talk", "lecture"] },
    "event": { "display": "Event", "keywords": ["event", "association", "party"] }
  }
}
```

### Fields

- `display` — label shown in the event filter dropdown
- `keywords` — matched against event kind text in the DOM (lowercase, substring match)
  - First keyword should always be the raw 42 API kind value

## campuses.json format

```json
{
  "campuses": [
    { "id": "12", "name": "Belgium" },
    { "id": "42", "name": "Paris" }
  ]
}
```

- `id` — numeric campus ID from the 42 API (as a string)
- `name` — display name shown in the campus selector
