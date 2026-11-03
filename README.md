# ENCORE! — a match-3 world tour

An ad-free match-3 that runs in its own small Mac window. You're a band on tour:
every level is a **gig**, every 10 gigs is a new **venue**, and every 10th gig is a 👑 headliner.

```bash
./build.sh                 # → build/Encore!.app (+ build/encore.html for any browser)
open "build/Encore!.app"
```

Progress is saved to `~/Library/Application Support/EncoreMatch/save.json`.
Controls: drag or click two tiles to swap, click a special twice to fire it where it stands, `Esc` pauses, `M` mutes.

## Specials

| Match | You get | What it does |
|---|---|---|
| 4 in a line | ↔ **Laser** | Clears the full row or column its arrow points along |
| 2×2 square | 🚀 **Rocket** | Hits the 4 tiles around it, then flies to whatever your goals still need |
| L or T shape | 💣 **Bomb** | Big diamond-shaped blast |
| 5 in a line | 🪩 **Disco ball** | Swap it with a tile to clear every tile of that colour |

**Swap two specials together:** laser+laser cross · laser+bomb triple-wide cross · bomb+bomb mega blast · 🚀+🚀 three rockets ·
🚀+laser/bomb the rocket carries that special to its target · 🪩+special turns every tile of that colour into that special and fires them all · 🪩+🪩 clears the whole stage.

## Goals (each gig has 1–3)

✨ Sweep glitter (the badge shows hits left) · 🧳 Smash flight cases (1 or 2 hits) · 🔌 Cut cables off locked tiles ·
⚡ Clear static (it spreads every turn you don't zap any) · 📀 Bring golden records down to the bottom ·
🎸 Collect N of an instrument · 🪩 Create N of a special · 🎯 Reach a score.
🔈 Speaker stacks are walls that can't be broken. Board shapes vary.

## What makes it exciting

- **HYPE meter → ENCORE MODE:** cascades fill the meter. When it's full you get 3 moves of double points,
  free specials drop onto the board, the spotlights go rainbow and the crowd goes wild.
- **Encore Finale:** every move you have left when you win becomes a laser, and they all fire at once for bonus points.
- **Rockets pick their own targets** using your goals, so 2×2 squares are always worth making.
- **Daily Gig:** one generated stage per day, the same for everyone. **Jam Session:** a 60-second score blitz;
  each special you make adds +1s and an Encore adds +5s.
- **Boosters** are earned, never bought: 🥁 Drumstick (smash one cell), 💣 Bomb (place a bomb), 🔀 Remix, ⏱ +5 moves.
  You get one as a fan gift for a new best, two for 3 stars.

## Procedural levels

Gigs 1–8 are hand-made tutorials. From gig 9 on, **the gig number is the seed** (`generateLevel` in `game/levels.js`),
so there's no end to the tour, but gig 42 is always the same gig 42. The generator:

1. Picks a board outline (corners, diamond, hourglass, pit, cross, stairs, castle, bites, …), mirrored or 4-way symmetric
2. Places unbreakable speaker-stack walls (pillars, shelves, center column, scatter)
3. Removes stray cells and falls back to a rectangle if the shape gets too sparse
4. Picks goal types and lays out obstacles in patterns (rings, checkers, stripes, blobs, clusters, zig-zags…).
   Double layers become more common as the gig number rises
5. Estimates how much work the goals need and sets the move count from that. Hard (every 5th) and headliner (every 10th) gigs get fewer moves

## Ideas for next

- **Boss gigs with a rival band:** a meter that fills each turn and throws static or cases onto the board unless you hit it with specials
- **Conveyor belts / rotating stage:** rows that shift one cell after every move
- **Portals** (tiles fall in one place and come out another) and **colour bombs that grow** each turn until you defuse them
- **Setlist chests:** clear 3 gigs in a row without failing to fill a chest with boosters, which resets if you lose
- **Tour posters:** every venue you finish unlocks a collectible poster/skin for the board
- **Instrument mastery:** collecting 1,000 🎸 over all gigs permanently upgrades the guitar's laser to 2 lines wide
- **Weekly playlist:** five seeded gigs with a shared leaderboard (seed = week number)
