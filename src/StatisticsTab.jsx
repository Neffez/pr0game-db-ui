import React, { useState, useEffect } from 'react';
import { useTheme, Box, Typography, TextField } from '@mui/material';
import { pb } from './api/pocketbase';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend
} from 'recharts';
import formatNumber from "./formatNumber";

export default function StatisticsTab() {
    const theme = useTheme();
    const [days, setDays] = useState(7);
    const [allisToShow, setAllisToShow] = useState(4);
    const [data, setData] = useState([]);
    const [alliances, setAlliances] = useState([]);
    const [selectedAlliances, setSelectedAlliances] = useState([]);

    const formatDateTime = (dateStr, withoutYear) => {
        const d = new Date(dateStr);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${withoutYear === false ? d.getFullYear() : ""} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    useEffect(() => {
        const fetchStats = async () => {
            const allis = await pb.collection('alliances').getFullList({ sort: 'alli_id' });
            setAlliances(allis);

            const threshold = new Date();
            threshold.setDate(threshold.getDate() - days);
            const isoThreshold = threshold.toISOString().split('T')[0];

            const ranks = await pb.collection('uni_rankings').getFullList({
                filter: `date >= \"${isoThreshold}\" && inactive = false`, // inactive players do not count into alliance points
                sort: 'date'
            });

            // only valid alliance entries (with all players of the alliance having points != -1)
            const validRanks = ranks.filter(r => r.alli_id > 0);
            const statsMap = {};
            const excludeMap = {};
            validRanks.forEach(r => {
                const { alli_id, date, points_points } = r;
                statsMap[alli_id] = statsMap[alli_id] || {};
                excludeMap[alli_id] = excludeMap[alli_id] || {};
                if (points_points === -1) {
                    excludeMap[alli_id][date] = true;
                } else {
                    statsMap[alli_id][date] = (statsMap[alli_id][date] || 0) + points_points;
                }
            });

            // Build chart data
            const dates = Array.from(new Set(validRanks.map(r => r.date))).sort();
            const chartData = dates.map(date => {
                const entry = { date };
                allis.forEach(a => {
                    const skip = excludeMap[a.alli_id] && excludeMap[a.alli_id][date];
                    entry[a.alli_name] = skip ? null : (statsMap[a.alli_id]?.[date] ?? null);
                });
                return entry;
            });
            setData(chartData);

            if (chartData.length === 0) {
                setAlliances([]);
                setSelectedAlliances([]);
                return;
            }

            // Determine latest totals using last date
            const lastEntry = chartData[chartData.length - 1];
            const nonZero = allis.filter(a => (lastEntry[a.alli_name] ?? 0) > 0);
            // Sort by descending latest points
            const sortedAlliances = nonZero.sort(
                (a, b) => (lastEntry[b.alli_name] || 0) - (lastEntry[a.alli_name] || 0)
            );
            setSelectedAlliances(sortedAlliances.slice(0, allisToShow).map(a => a.alli_id));
        };

        fetchStats();
    }, [days, allisToShow]);

    const getColor = idx => `hsl(${(idx * 360) / alliances.length}, 70%, 50%)`; // generate an HSL color for each alliance

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <Box sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    borderRadius: 1,
                    padding: theme.spacing(1)
                }}>
                    <Typography variant="caption" sx={{ color: '#fff', mb: 0.5 }}>
                        {formatDateTime(label, false)}
                    </Typography>
                    {payload.map((entry, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <Box sx={{
                                width: theme.spacing(1),
                                height: theme.spacing(1),
                                backgroundColor: entry.color,
                                borderRadius: '50%',
                                mr: theme.spacing(1)
                            }} />
                            <Typography variant="body2" sx={{ color: '#fff', fontSize: '0.75rem' }}>
                                {entry.name}: {formatNumber(entry.value)}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            );
        }
        return null;
    };

    // filter alliances per click
    const handleLegendClick = e => {
        const name = e.dataKey;
        const alli = alliances.find(a => a.alli_name === name);
        if (!alli) return;
        setSelectedAlliances(prev =>
            prev.includes(alli.alli_id)
                ? prev.filter(id => id !== alli.alli_id)
                : [...prev, alli.alli_id]
        );
    };

    return (
        <Box>
            <ResponsiveContainer
                width="100%"
                height={400}
                style={{ backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 10, padding: '8px' }}
            >
                <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDateTime}
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis
                        domain={[ 'dataMin', 'auto' ]}
                        tickFormatter={formatNumber}
                        tick={{  fontSize: 15 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend onClick={handleLegendClick} />
                    {alliances.map((a, idx) => (
                        <Line
                            key={a.alli_id}
                            type="monotone"
                            dataKey={a.alli_name}
                            stroke={getColor(idx)}
                            dot={{ stroke: getColor(idx), fill: getColor(idx) }}
                            connectNulls
                            hide={!selectedAlliances.includes(a.alli_id)}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                <TextField
                    label="Tage"
                    type="number"
                    size="small"
                    value={days}
                    onChange={e => setDays(Math.max(1, Number(e.target.value) || 1))}
                    slotProps={{ input: { min: 1 }}}
                />
                <TextField
                    label="Top"
                    type="number"
                    size="small"
                    value={allisToShow}
                    onChange={e => setAllisToShow(Math.max(1, Number(e.target.value) || 1))}
                    slotProps={{ input: { min: 1 }}}
                />
            </Box>
        </Box>
    );
}
