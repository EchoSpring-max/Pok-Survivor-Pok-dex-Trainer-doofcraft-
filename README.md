# PokéSurvivor Desktop

An unofficial Windows desktop client for [PokéSurvivor](https://pokesurvivor.doofcraft.com/) with a built-in local JavaScript loader.

## Features

- Isolated game view with Node.js disabled, context isolation, sandboxing, origin-locked navigation, blocked popups, and denied permission requests.
- Local `.js` imports only; the client never downloads scripts from a URL.
- Persistent run/stop state: running a script remembers it for future client launches and runs it once at startup. Page reloads do not automatically run it again; stopping it disables startup. Includes reload/home controls, a detached developer console, and an emergency stop-all action.
- Per-script cleanup: return a function from a script and the client calls it when the script is stopped, disabled, rerun, or removed.
- Persistent game login, cookies, site storage, and script preferences across client restarts and upgrades.
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

## Script format

Scripts execute in the PokéSurvivor page. Add an optional display name and return an optional cleanup function:

```js
// @name My UI tweak

const element = document.createElement('div');
element.textContent = 'Hello';
document.body.appendChild(element);

return () => element.remove();
```

See [`examples/hello-overlay.js`](examples/hello-overlay.js) for a complete harmless example.

## Existing userscript

This repository also retains [`PokeSurvivor-Pokedex-Trainer.js`](PokeSurvivor-Pokedex-Trainer.js), the original standalone Tampermonkey trainer. It is not bundled into the desktop executable or enabled automatically. If you choose to use it, review the source, import it manually, and follow the game's rules.

## Security note

A loaded script has the same page access as code running on the game website, including access to visible game state and browser storage. Only run scripts you understand and trust. The desktop client deliberately does not include a remote script marketplace, URL installer, or bundled game automation.

## Disclaimer

This community project is not affiliated with DoofCraft, PokéSurvivor, Nintendo, Creatures Inc., GAME FREAK, or The Pokémon Company. Follow the game's rules when using custom scripts.
