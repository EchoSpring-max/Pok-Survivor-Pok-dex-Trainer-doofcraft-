# PokéSurvivor Desktop

An unofficial Windows desktop client for [PokéSurvivor](https://pokesurvivor.doofcraft.com/) with the Pokédex Trainer built in.

## Features

- Sandboxed game view with Node.js disabled, origin-locked navigation, blocked popups, and denied permission requests.
- Built-in Pokédex Trainer loaded automatically at document start, with live damage, speed, Candy Corn, god-mode, AFK, bonding, and solo-rift controls.
- Pokédex-styled trainer overlay that can be opened or hidden from the sidebar or with F8.
- Background throttling and app suspension disabled so the game keeps running when minimized or unfocused.
- Persistent game login, cookies, site storage, and trainer preferences across client restarts and upgrades.
- Reload/home controls and a detached developer console.
- Optional Discord Rich Presence with reconnect handling, current screen status, elapsed play time, and a play button.
- Persistent game volume slider and mute control.

## Discord Rich Presence

Rich Presence is preconfigured and enabled by default. Keep the Discord desktop app running; the client reconnects automatically when Discord restarts. The sidebar toggle can disable the presence at any time.

## Development

```powershell
npm install
npm test
npm start
```

Create a portable Windows executable:

```powershell
npm run dist
```

The build is written to `outputs/`.

## Standalone userscript

The same trainer remains available as [`PokeSurvivor-Pokedex-Trainer.user.js`](PokeSurvivor-Pokedex-Trainer.user.js) for regular browsers. The desktop executable bundles its own copy automatically.

## Security note

The built-in trainer has page-level access to visible game state and the game's browser storage. The client does not download or execute trainer code from remote URLs.

## Disclaimer

This community project is not affiliated with DoofCraft, PokéSurvivor, Nintendo, Creatures Inc., GAME FREAK, or The Pokémon Company. Follow the game's rules when using the trainer.
