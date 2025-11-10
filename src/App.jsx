import React, {useState, useCallback, useEffect} from 'react'
import {pb} from './api/pocketbase'
import debounce from 'lodash.debounce'
import {
    AppBar,
    Toolbar,
    Typography,
    Container,
    TextField,
    Button,
    IconButton,
    Box,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Tooltip,
    Paper,
    Grid,
    Tabs,
    Tab
} from '@mui/material'
import StatisticsTab from './StatisticsTab';
import {saveAs} from 'file-saver'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import formatNumber from "./formatNumber";

// Mapping ID → Name
const locMap = {
    "901": "Metall",
    "902": "Kristall",
    "903": "Deuterium",
    "911": "Energie",
    "1": "Metallmine",
    "2": "Kristallmine",
    "3": "Deuteriumsynthetisierer",
    "4": "Solarkraftwerk",
    "12": "Fusionskraftwerk",
    "22": "Metallspeicher",
    "23": "Kristallspeicher",
    "24": "Deuteriumtank",
    "14": "Roboterfabrik",
    "15": "Nanitenfabrik",
    "21": "Raumschiffwerft",
    "31": "Forschungslabor",
    "33": "Terraformer",
    "34": "Allianzdepot",
    "35": "Reparaturdock",
    "41": "Mondbasis",
    "42": "Sensorphalanx",
    "43": "Sprungtor",
    "44": "Raketensilo",
    "401": "Raketenwerfer",
    "402": "Leichtes Lasergeschütz",
    "403": "Schweres Lasergeschütz",
    "404": "Gausskanone",
    "405": "Ionenkanone",
    "406": "Plasmakanone",
    "407": "kleine Schildkuppel",
    "408": "große Schildkuppel",
    "502": "Abfangrakete",
    "503": "Interplanetarrakete",
    "202": "Kleiner Transporter",
    "203": "Großer Transporter",
    "204": "Leichter Jäger",
    "205": "Schwerer Jäger",
    "206": "Kreuzer",
    "207": "Schlachtschiff",
    "208": "Kolonieschiff",
    "209": "Recycler",
    "210": "Spionagesonden",
    "211": "Bomber",
    "212": "Solarsatelliten",
    "213": "Zerstörer",
    "214": "Todesstern",
    "215": "Schlachtkreuzer",
    "106": "Spionagetechnik",
    "108": "Computertechnik",
    "109": "Waffentechnik",
    "110": "Schildtechnik",
    "111": "Raumschiffpanzerung",
    "113": "Energietechnik",
    "114": "Hyperraumtechnik",
    "115": "Verbrennungstriebwerk",
    "117": "Impulstriebwerk",
    "118": "Hyperraumantrieb",
    "120": "Lasertechnik",
    "121": "Ionentechnik",
    "122": "Plasmatechnik",
    "123": "Intergalaktisches Forschungsnetzwerk",
    "124": "Astrophysik",
    "199": "Gravitonforschung",
    "131": "Produktionsmaximierung Metall",
    "132": "Produktionsmaximierung Kristall",
    "133": "Produktionsmaximierung Deuterium"
}

function getStatusColor(ranking) {
    if (!ranking) return 'white';
    if (ranking.banned) return '#6B002A';          // banned
    if (ranking.umode) return '#497290';         // U-Mode
    if (ranking.inactive || ranking.inactive_long) return '#999999';         // inactive
    return 'white';
}

export default function App() {
    const [user, setUser] = useState(pb.authStore.isValid ? pb.authStore.model : null)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    // Spielersuche states
    const [search, setSearch] = useState('')
    const [players, setPlayers] = useState([])
    const [selectedPlayer, setSelectedPlayer] = useState(null)
    const [research, setResearch] = useState({})
    const [celestials, setCelestials] = useState({planets: [], moons: []})
    const [spyReports, setSpyReports] = useState({})
    const [alliances, setAlliances] = useState({})
    const [latestReport, setLatestReport] = useState(null)
    const [ranking, setRanking] = useState(null)
    const [playerStatuses, setPlayerStatuses] = useState({});
    // Phalanx states
    const [phalanxSearch, setPhalanxSearch] = useState('')
    const [phalanxResults, setPhalanxResults] = useState([])
    // tab control
    const [tabValue, setTabValue] = useState(0)

    // Load alliances on mount
    useEffect(() => {
        const fetchAlliances = async () => {
            try {
                const allis = await pb.collection('alliances').getFullList({sort: 'alli_name'})
                const map = Object.fromEntries(allis.map(a => [a.alli_id, a.alli_name]))
                setAlliances(map)
            } catch (err) {
                console.error('Failed to load alliances', err)
            }
        }
        fetchAlliances()
    }, [])


    // Debounced player search
    const debouncedSearch = useCallback(debounce(async val => {
        if (!val) {
            setPlayers([])
            setPlayerStatuses({})
            return
        }
        if (!val) return setPlayers([])
        const res = await pb.collection('players').getFullList({
            filter: pb.filter('player_name ~ {:s}', {s: val}), sort: 'player_name'
        })
        const ids = res.map(p => p.player_id)          // [1, 42, 133, …]
        if (ids.length) {
            const filterStr = ids.map(id => `player_id = ${id}`).join(' || ')
            const ranks = await pb.collection('uni_rankings').getFullList({
                filter: filterStr, sort: '-date',
            })
            const latest = {}
            ranks.forEach(r => {
                if (!latest[r.player_id]) latest[r.player_id] = r
            })
            setPlayerStatuses(latest)
        } else {
            setPlayerStatuses({})
        }

        setPlayers(res)
    }, 300), [])

    const handleSearchChange = e => {
        setSearch(e.target.value)
        debouncedSearch(e.target.value)
    }

    useEffect(() => {
        const ids = phalanxResults
            .map(r => r.playerId)
            .filter(id => id != null)

        if (!ids.length) return

            ;(async () => {
            try {
                const filterStr = ids.map(id => `player_id = ${id}`).join(' || ')
                const ranks = await pb.collection('uni_rankings').getFullList({
                    filter: filterStr,
                    sort: '-date',
                })
                const latest = {}
                ranks.forEach(r => {
                    if (!latest[r.player_id]) latest[r.player_id] = r
                })
                setPlayerStatuses(prev => ({ ...prev, ...latest }))
                // zwingt React, diesen Effect zu „lesen“
                setDummy({})
            } catch (error) {
                console.error('Fehler beim Laden der Phalanx-Statuses:', error)
            }
        })()
    }, [phalanxResults])


    // Debounced Phalanx-Search
    const debouncedPhalanx = useCallback(debounce(async (val) => {
        try {
            const raw = val.trim()
            if (!raw) return setPhalanxResults([])
            // system from 1 to 400
            const systemFilter = parseInt(raw, 10)
            if (!systemFilter || systemFilter < 1 || systemFilter > 400) return setPhalanxResults([])

            // load all moons
            const states = await pb.collection('galaxy_state').getFullList({filter: pb.filter('has_moon = true')})
            // collect report IDs
            const allRptIds = states.flatMap(rec => {
                const blds = rec.moon_buildings
                if (!blds) return []
                return (Array.isArray(blds) ? blds : [blds]).filter(id => !!id)
            })
            const uniqueRptIds = Array.from(new Set(allRptIds))
            if (!uniqueRptIds.length) return setPhalanxResults([])
            // fetch all spy reports once
            const allReports = await pb.collection('spy_reports').getFullList({sort: '-timestamp'})
            const reportsMap = Object.fromEntries(allReports.filter(r => uniqueRptIds.includes(r.id)).map(r => [r.id, r]))

            // compute matches
            const matches = []
            for (const rec of states) {
                const ids = rec.moon_buildings ? (Array.isArray(rec.moon_buildings) ? rec.moon_buildings : [rec.moon_buildings]) : []
                const latest = ids
                    .map(id => reportsMap[id])
                    .filter(r => r)
                    .sort((a, b) => b.timestamp - a.timestamp)[0]
                if (!latest) continue
                const lvl = latest.cat0?.['42'] || 0
                if (lvl <= 0) continue
                const range = Math.pow(lvl, 2) - 1
                const rawDiff = Math.abs(rec.pos_system - systemFilter)
                const diff = Math.min(rawDiff, 400 - rawDiff)
                if (diff > range) continue
                matches.push(rec)
            }
            if (!matches.length) return setPhalanxResults([])

            // dedupe per player
            const uniqueMatches = Array.from(new Map(matches.map(m => [m.player_id, m])).values())
            const playerIds = uniqueMatches.map(m => m.player_id)
            // fetch all players once
            const allPlayers = await pb.collection('players').getFullList()
            const playersMap = Object.fromEntries(allPlayers.filter(p => playerIds.includes(p.player_id)).map(p => [p.player_id, p]))

            // assemble results with alliance
            const results = uniqueMatches.map(rec => {
                const player = playersMap[rec.player_id]
                const alliName = player?.alli_id ? alliances[player.alli_id] : null
                return {
                    playerId: rec.player_id, name: player?.player_name || 'unbekannt', alliance: alliName, allianceId: player?.alli_id || null, coord: [rec.pos_galaxy, rec.pos_system, rec.pos_planet]
                }
            })

            setPhalanxResults(results)
        } catch (err) {
            if (err.message && err.message.includes('autocancelled')) return
            console.error(err)
        }
    }, 500), [alliances])

    const handlePhalanxChange = e => {
        setPhalanxSearch(e.target.value)
        debouncedPhalanx(e.target.value)
    }


    // Load player data: research, galaxy state and spy reports
    const loadPlayerData = async (player) => {
        setSelectedPlayer(player)

        const reportsAll = await pb.collection('spy_reports').getFullList({
            filter: pb.filter('player = {:pid}', {pid: player.id}), sort: '-created'
        })
        const withResearch = reportsAll
            .filter(r => r.cat100 && Object.values(r.cat100).some(v => v > 0))

        const latest = withResearch
            .sort((a, b) => {
                const countA = Object.values(a.cat100).filter(v => v > 0).length
                const countB = Object.values(b.cat100).filter(v => v > 0).length
                return countB - countA
            })[0] || null
        try {
            // load ranking from uni_rankings
            try {
                const rankList = await pb.collection('uni_rankings').getFullList({
                    filter: pb.filter('player_id = {:pid}', {pid: player.player_id}), sort: '-date'
                });
                const validRanks = rankList.filter(r => [r.points_points, r.rank_points, r.points_buildings, r.rank_buildings, r.points_defense, r.rank_defense, r.points_fleet, r.rank_fleet, r.points_research, r.rank_research].every(v => v !== -1));

                setRanking(validRanks[0] || null);
            } catch {
                setRanking(null);
            }
        } catch {
            console.log('Error in loadPlayerData')
            setRanking(null)
        }
        setLatestReport(latest);
        setResearch(latest ? latest.cat100 : {});

        // Galaxy state
        const states = await pb.collection('galaxy_state').getFullList({
            filter: pb.filter('player_id = {:pid} && is_destroyed = false', {pid: player.player_id}), sort: 'pos_galaxy,pos_system,pos_planet'
        })
        const recMap = Object.fromEntries(states.map(r => [r.id, r]))
        // Build planets and moons with unique IDs
        const planets = states
            .filter(r => r.planet_id > 0)
            .map(r => ({
                id: `p_${r.id}`, recId: r.id, name: r.planet_name, coord: [r.pos_galaxy, r.pos_system, r.pos_planet]
            }))
        const moons = states
            .filter(r => r.has_moon)
            .map(r => ({
                id: `m_${r.id}`, recId: r.id, name: r.moon_name, coord: [r.pos_galaxy, r.pos_system, r.pos_planet]
            }))
        setCelestials({planets, moons})

        // Spy reports per celestial (distinct keys)
        const sr = {}
        // Reports for planets
        for (const c of planets) {
            const rec = recMap[c.recId]
            const rel = rec.planet_buildings
            const rptId = Array.isArray(rel) ? rel[0] : rel
            sr[c.id] = rptId ? await pb.collection('spy_reports').getOne(rptId) : null
        }
        // Reports for moons
        for (const c of moons) {
            const rec = recMap[c.recId]
            const rel = rec.moon_buildings
            const rptId = Array.isArray(rel) ? rel[0] : rel
            sr[c.id] = rptId ? await pb.collection('spy_reports').getOne(rptId) : null
        }
        setSpyReports(sr)
    }

    const handleExport = async () => {
        const [galaxyRecs, playerRecs, alliRecs, uniRankRecs] = await Promise.all([
            pb.collection('galaxy_state').getFullList({
                filter:  'is_destroyed = false',
                sort:    'pos_system,pos_planet',
                fields:  'pos_galaxy,pos_system,pos_planet,planet_name,has_moon,player_id'
            }),
            pb.collection('players').getFullList(),
            pb.collection('alliances').getFullList(),
            // pb.collection('uni_rankings').getFullList()
        ])

        // const uniMap = {}
        // uniRankRecs.forEach(r => {
        //     const pid = r.player_id
        //     if (!uniMap[pid] || new Date(r.updated) > new Date(uniMap[pid].updated)) {
        //         uniMap[pid] = r
        //     }
        // })
        //
        // const computeSpecial = (rank = {}) => {
        //     let s = ''
        //     if (rank.banned) s += 'g'
        //     if (rank.umode) s += 'u'
        //     if (rank.inactive_long) s += 'I'
        //     if (rank.inactive) s += 'i'
        //     return s
        // }

        const alliNameMap = Object.fromEntries(alliRecs.map(a => [a.alli_id, a.alli_name]))
        const playerInfoMap = Object.fromEntries(
            playerRecs.map(p => [p.player_id, {
                name: p.player_name,
                allianceid: p.alli_id,
                alliancename: alliNameMap[p.alli_id] ?? '-'
            }])
        )

        const galaxy = {}
        for (let sys = 1; sys <= 400; sys++) {
            const key = `1:${sys}`
            const slots = {timepoint: Date.now()}
            for (let pos = 1; pos <= 15; pos++) {
                const rec = galaxyRecs.find(r =>
                    r.pos_galaxy === 1 && r.pos_system === sys && r.pos_planet === pos
                )
                if (!rec) {
                    slots[pos] = null
                } else {
                    const p = playerInfoMap[rec.player_id] || {name: '', allianceid: -1, alliancename: '-'}
                    slots[pos] = {
                        planetname: rec.planet_name,
                        hasmoon: rec.has_moon,
                        playerid: rec.player_id,
                        name: p.name,
                        allianceid: p.allianceid === -1 ? 0 : p.allianceid,
                        alliancename: p.alliancename,
                        special: ''//computeSpecial(uniMap[rec.player_id])
                    }
                }
            }
            galaxy[key] = slots
        }

        const players = {}
        playerRecs.forEach(p => {
            players[p.player_id] = {
                name: p.player_name,
                timepoint: new Date(p.updated).getTime()
            }
        })

        const alliances = {}
        alliRecs.forEach(a => {
            alliances[a.alli_id] = {
                name: a.alli_name,
                timepoint: new Date(a.updated).getTime()
            }
        })

        const data = [galaxy, players, alliances]
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'})
        saveAs(blob, `export_${Date.now()}.json`)
    }

    const handleLogin = async () => {
        try {
            const auth = await pb.collection('users').authWithPassword(username, password)
            setUser(auth.record)
        } catch {
            alert('Login fehlgeschlagen')
        }
    }

    // Render login or main UI
    return (<>
        {/* Fixed Background Layer */}
        <Box
            component="div"
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1,
                backgroundImage: `url(https://pr0game.com/styles/resource/images/login/background.jpg)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        />
        {!user ? (<Container maxWidth="sm" sx={{mt: 4}}>
            <Box sx={{display: 'flex'}}>
                <Typography variant="h4" gutterBottom>Login</Typography>
                <Box sx={{flexGrow: 1}}/>
                <Tooltip title="View Code on GitHub">
                    <IconButton color="inherit" component="a" href="https://github.com/Neffez/pr0game-db-ui" target="_blank" rel="noopener">
                        <img src="/assets/github-mark-white.svg" alt="GitHub" style={{width: 22, height: 22}}/>
                    </IconButton>
                </Tooltip>
            </Box>
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                <TextField label="Benutzername" value={username} onChange={e => setUsername(e.target.value)} fullWidth/>
                <TextField label="Passwort" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={(e) => (
                    e.key === 'Enter' ? handleLogin() : null
                )} fullWidth/>
                <Button variant="contained" onClick={handleLogin}>Login</Button>
            </Box>
        </Container>) : (<Box sx={{position: 'relative', zIndex: 0}}>
            <AppBar position="static">
                <Toolbar>
                    <Tabs
                        value={tabValue}
                        onChange={(e, newVal) => setTabValue(newVal)}
                        textColor="inherit"
                        indicatorColor="secondary"
                    >
                        <Tab label="Spielersuche"/>
                        <Tab label="Phalanx"/>
                        <Tab label="Allianzen" />
                    </Tabs>
                    <Box sx={{flexGrow: 1}}/>
                    <Tooltip title="Download JSON">
                        <IconButton color="inherit" onClick={handleExport}>
                            <img src="/assets/download-icon.svg" alt="Download JSON" style={{width: 22, height: 22}}/>
                        </IconButton>
                    </Tooltip>
                    <Box sx={{display: 'flex', width: 5}}/>|<Box sx={{display: 'flex', width: 5}}/>
                    <Tooltip title="View Code on GitHub">
                        <IconButton color="inherit" component="a" href="https://github.com/Neffez/pr0game-db-ui" target="_blank" rel="noopener">
                            <img src="/assets/github-mark-white.svg" alt="GitHub" style={{width: 22, height: 22}}/>
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>
            <Container sx={{mt: 4}}>
                {/* Spielersuche */}
                {tabValue === 0 && (<>
                    <TextField
                        label="Spielername"
                        value={search}
                        onChange={handleSearchChange}
                        fullWidth
                        sx={{mb: 2}}
                    />
                    <Paper sx={{mb: 3}}>
                        {players.map(p => {
                            return (<Box
                                key={p.id}
                                onClick={() => loadPlayerData(p)}
                                sx={{
                                    p: 1, borderBottom: '1px solid #333', cursor: 'pointer', color: getStatusColor(playerStatuses[p.player_id]),
                                }}
                            >
                                {p.player_name} {alliances[p.alli_id] ? `(${alliances[p.alli_id]})` : ''}
                            </Box>)
                        })}
                    </Paper>

                    {selectedPlayer && (<Box>
                        <Typography
                            variant="h5"
                            sx={{
                                mb: 2, px: 1, py: 0.5, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1, display: 'inline-block', color: getStatusColor(ranking),
                            }}
                        >
                            {selectedPlayer.player_name}
                            {alliances[selectedPlayer.alli_id] && ` (${alliances[selectedPlayer.alli_id]})`}
                            {latestReport?.timestamp && (<Typography component="span" variant="body2" sx={{ml: 1, color: 'text.secondary'}}>
                                {latestReport.timestamp}
                            </Typography>)}
                        </Typography>
                        {ranking && (<Box sx={{mb: 2, bgcolor: 'rgba(0,0,0,0.6)', px: 1, py: 0.5, borderRadius: 1}}>
                            <Typography variant="body2">
                                Gesamt: {formatNumber(ranking.points_points)} Pkt. (Rang {ranking.rank_points}) |
                                Flotte: {formatNumber(ranking.points_fleet)} Pkt. (Rang {ranking.rank_fleet}) |
                                Verteidigung: {formatNumber(ranking.points_defense)} Pkt. (Rang {ranking.rank_defense}) |
                                Forschung: {formatNumber(ranking.points_research)} Pkt. (Rang {ranking.rank_research}) |
                                Gebäude: {formatNumber(ranking.points_buildings)} Pkt. (Rang {ranking.rank_buildings})
                            </Typography>
                        </Box>)}
                        {/* Forschungs-Accordion */}
                        <Accordion defaultExpanded sx={{mb: 2}}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                <Typography>Forschungen</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {Object.entries(research).filter(([, v]) => v > 0).length === 0 ? (<Typography>Keine Forschung</Typography>) : (
                                    <TableContainer component={Paper} sx={{maxWidth: 400}}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{py: 0.5, px: 1}}>Name</TableCell>
                                                    <TableCell align="right" sx={{py: 0.5, px: 1}}>Level</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {Object.entries(research).filter(([, v]) => v > 0).map(([k, v]) => (<TableRow key={k} hover>
                                                    <TableCell sx={{py: 0.5, px: 1}}>{locMap[k] || k}</TableCell>
                                                    <TableCell align="right" sx={{py: 0.5, px: 1}}>{v}</TableCell>
                                                </TableRow>))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>)}
                            </AccordionDetails>
                        </Accordion>

                        {/* Planeten & Monde */}
                        {['Planeten', 'Monde'].map((lbl, i) => {
                            const list = i === 0 ? celestials.planets : celestials.moons
                            return (<Accordion key={lbl} defaultExpanded sx={{mb: 2}}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                    <Typography>{lbl}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    {list.filter(c => {
                                        const rpt = spyReports[c.id];
                                        if (!rpt) return false;
                                        // Check any category has data > 0
                                        const cats = ['cat900', 'cat0', 'cat400', 'cat200'];
                                        return cats.some(cat => Object.values(rpt[cat] || {}).some(v => v > 0));
                                    }).map(c => {
                                        const rpt = spyReports[c.id]
                                        return (<Accordion key={c.id} sx={{mb: 1}}>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                                <Typography>{c.name} ({c.coord.join(':')})</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                {rpt ? (<Grid container spacing={1}>
                                                    {['cat900', 'cat0', 'cat400', 'cat200'].map(cat => {
                                                        const title = cat === 'cat0' ? 'Gebäude' : cat === 'cat200' ? 'Flotte' : cat === 'cat400' ? 'Verteidigung' : 'Ressourcen'
                                                        const data = Object.entries(rpt[cat] || {}).filter(([, v]) => v > 0)
                                                        return (<Grid item xs={12} sm={4} key={cat}>
                                                            <TableContainer component={Paper} variant="outlined">
                                                                <Table size="small" stickyHeader>
                                                                    <TableHead>
                                                                        <TableRow>
                                                                            <TableCell sx={{py: 0.5, px: 1}}>{title}</TableCell>
                                                                            <TableCell align="right" sx={{py: 0.5, px: 1}}></TableCell>
                                                                        </TableRow>
                                                                    </TableHead>
                                                                    <TableBody>
                                                                        {data.map(([k, v]) => (<TableRow key={k} hover>
                                                                            <TableCell sx={{py: 0.5, px: 1}}>{locMap[k] || k}</TableCell>
                                                                            <TableCell align="right" sx={{py: 0.5, px: 1}}>{formatNumber(v)}</TableCell>
                                                                        </TableRow>))}
                                                                    </TableBody>
                                                                </Table>
                                                            </TableContainer>
                                                        </Grid>)
                                                    })}
                                                </Grid>) : (<Typography>Keine Daten</Typography>)}
                                            </AccordionDetails>
                                        </Accordion>)
                                    })}
                                </AccordionDetails>
                            </Accordion>)
                        })}
                    </Box>)}
                </>)}
                {/* Phalanx */}
                {tabValue === 1 && (<>
                    <TextField
                        label="System"
                        value={phalanxSearch}
                        onChange={handlePhalanxChange}
                        fullWidth
                        sx={{mb: 2}}
                    />
                    <Paper>
                        {phalanxResults.length === 0 ? (
                            <Typography sx={{ p: 2 }}>Keine Phalanx</Typography>
                        ) : (
                            phalanxResults.map((r, idx) => (
                                <Box
                                    key={`${r.playerId}_${idx}`}
                                    sx={{
                                        p: 1,
                                        borderBottom: idx < phalanxResults.length - 1 ? '1px solid #333' : 'none',
                                        color: getStatusColor(playerStatuses[r.playerId]) === 'white' ? (r.allianceId === 643 ? 'lightgreen' : 'white') : getStatusColor(playerStatuses[r.playerId])
                                    }}
                                >
                                    {r.name} ({r.coord.join(':')})
                                    {r.alliance ? ` – ${r.alliance}` : ''}
                                </Box>
                            ))
                        )}
                    </Paper>
                </>)}
                {/* Statistik */}
                {tabValue === 2 &&
                    <StatisticsTab/>}
            </Container>
        </Box>)}
    </>)
}