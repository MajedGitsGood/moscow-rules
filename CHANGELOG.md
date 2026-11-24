# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- First playable build: setup on six cities, eight agents a side (Scalphunter, Lamplighter, Ferret,
  Talent-spotter) in a rock-paper-scissors cycle, free-text cables, Watch / Move / Strike / Expose /
  Recruit / Lie low, turned agents that leak, lie and sabotage, a 12-week end with an elimination count.
- Three modes: against Karla (Claude), against an offline bot, two-player hot-seat.
- Board with automatic last-seen positions, a notebook for roles and loyalty, a debrief that reveals
  every agent, every leaked cable and Karla's journal.
- Claude integration through a local proxy (`server.js`): Opus 5.5 for Karla, Haiku 5.5 for cable
  interpretation and agent voices, per-session token budgets, owner bypass, offline fallbacks throughout.
- Field Manual (in game) and `STRATEGY.md`; rule checks (`npm test`) and balance simulation (`npm run simulate`).
