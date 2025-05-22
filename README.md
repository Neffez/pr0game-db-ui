# pr0game / pr0script UI
A simple UI to view the collected data from https://github.com/pastellblau/pr0script (or the forked https://github.com/Neffez/pr0script).

---
You will need to point to your pocketbase in /src/api/pocketbase.js
or use the environment variable.

---
### Features
* Search for players and list their data from recent spy_reports.
* Search for system and list phalanxes in range
* Create and download a universe json file to import into pr0game galaxy view
* View alliance stats as a graph over time

---
### How to run

```
 npm install 
 npm run dev
```

---

### Stuff to do:

* better project structure
* currently only implemented for Uni5 (1 galaxy, 400 systems)
* language selection
* graphical view of player stats over time
