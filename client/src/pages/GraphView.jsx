import {useEffect, useMemo, useState} from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide} from 'd3-force'
import {fetchAllNotes} from '../api/notes'
import {useToast} from '../context/ToastContext'
import {folderColor} from '../utils/folderColor'

const WIDTH = 900
const HEIGHT = 560
const PAD = 36

// Runs the simulation to convergence synchronously (fixed tick count) and
// renders the settled result as static SVG — simpler and more predictable
// than animating a live simulation for a first version of this view.
//
// Only notes with at least one [[link]] are laid out on the canvas — most
// notes in a given account have zero links (the wikilink feature is opt-in),
// and force-simulating a couple dozen mutually unrelated nodes just produces
// a meaningless scatter of dots with nothing connecting them. Unlinked notes
// are still fully visible, just as a plain browsable list below the canvas
// instead of pretending they belong on a "graph".
function layoutGraph(notes) {
	const idSet = new Set(notes.map((n) => n._id))
	const links = notes.flatMap((n) =>
		(n.links || [])
			.filter((targetId) => idSet.has(targetId) && targetId !== n._id)
			.map((targetId) => ({source: n._id, target: targetId}))
	)

	const degree = new Map()
	for (const l of links) {
		degree.set(l.source, (degree.get(l.source) || 0) + 1)
		degree.set(l.target, (degree.get(l.target) || 0) + 1)
	}

	const linkedNotes = notes.filter((n) => degree.has(n._id))
	const unlinkedNotes = notes.filter((n) => !degree.has(n._id))
	const nodes = linkedNotes.map((n) => ({id: n._id, title: n.title, folder: n.folder}))

	const simulation = forceSimulation(nodes)
		.force('link', forceLink(links).id((d) => d.id).distance(95).strength(0.6))
		.force('charge', forceManyBody().strength(-220))
		.force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
		.force('collide', forceCollide(28))
		.stop()

	for (let i = 0; i < 300; i++) simulation.tick()

	// The simulation has no hard boundary — isolated pairs/small clusters with
	// nothing else pulling on them can drift past the canvas edge and render
	// clipped. Clamp into the visible area as a final pass.
	for (const n of nodes) {
		n.x = Math.min(WIDTH - PAD, Math.max(PAD, n.x))
		n.y = Math.min(HEIGHT - PAD, Math.max(PAD, n.y))
	}

	return {
		nodes: nodes.map((n) => ({...n, degree: degree.get(n.id) || 0})),
		links,
		unlinkedNotes,
	}
}

function GraphView() {
	const [notes, setNotes] = useState([])
	const [loading, setLoading] = useState(true)
	const [loadFailed, setLoadFailed] = useState(false)
	const [hoveredId, setHoveredId] = useState(null)
	const navigate = useNavigate()
	const toast = useToast()

	useEffect(() => {
		let ignore = false
		;(async () => {
			try {
				// Must be every note, not the first page: an edge is only drawn
				// when both endpoints are present, so a truncated fetch silently
				// erases links rather than just hiding distant nodes.
				const {notes: allNotes} = await fetchAllNotes()
				if (!ignore) setNotes(allNotes)
			} catch {
				// Also sets loadFailed — without it `notes` stays [] and the
				// render below shows "No notes yet", which is a factually wrong
				// message for a network failure and offers no way to retry.
				if (!ignore) {
					setLoadFailed(true)
					toast.error('Could not load the graph.')
				}
			} finally {
				if (!ignore) setLoading(false)
			}
		})()
		return () => { ignore = true }
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch, matches Dashboard's own pattern
	}, [])

	const {nodes, links, unlinkedNotes} = useMemo(() => layoutGraph(notes), [notes])

	const folderLegend = useMemo(() => {
		const seen = new Map()
		for (const n of notes) {
			if (!seen.has(n.folder)) seen.set(n.folder, folderColor(n.folder))
		}
		return Array.from(seen, ([folder, color]) => ({folder, color}))
	}, [notes])

	const openNote = (id) => navigate('/dashboard', {state: {openNoteId: id}})

	const hoveredNeighborIds = useMemo(() => {
		if (!hoveredId) return null
		const ids = new Set([hoveredId])
		for (const l of links) {
			const source = l.source.id ?? l.source
			const target = l.target.id ?? l.target
			if (source === hoveredId) ids.add(target)
			if (target === hoveredId) ids.add(source)
		}
		return ids
	}, [hoveredId, links])

	return (
		<div className="min-h-screen p-[18px] min-[761px]:p-7 flex flex-col gap-5">
			<div className="flex items-start justify-between flex-wrap gap-3">
				<div className="flex items-center gap-3">
					<Link
						to="/dashboard"
						aria-label="Back to notes"
						className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center bg-ink/8 border border-ink/15 text-ink cursor-pointer transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
					</Link>
					<div>
						<h1 className="text-lg font-bold">Graph view</h1>
						<p className="text-[12px] text-ink/45">
							{nodes.length} connected note{nodes.length === 1 ? '' : 's'} · {links.length} link{links.length === 1 ? '' : 's'} · {unlinkedNotes.length} not yet linked
						</p>
					</div>
				</div>

				{folderLegend.length > 0 && (
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-1.5 px-3 rounded-full bg-ink/5 border border-ink/10">
						{folderLegend.map(({folder, color}) => (
							<div key={folder} className="flex items-center gap-1.5 text-[11px] text-ink/60">
								<span className="w-2 h-2 rounded-full shrink-0" style={{background: color}} />
								{folder}
							</div>
						))}
					</div>
				)}
			</div>

			<div className="rounded-[16px] border border-ink/12 bg-ink/4 overflow-hidden">
				{loading ? (
					<div className="h-[420px] flex items-center justify-center text-ink/40 text-[13px]">Loading graph…</div>
				) : loadFailed ? (
					<div className="h-[420px] flex flex-col items-center justify-center gap-3 text-center">
						<p className="text-[13px] text-ink/50">Could not load the graph.</p>
						<button
							onClick={() => window.location.reload()}
							className="py-2 px-4 rounded-[10px] bg-ink/8 border border-ink/15 text-[12.5px] font-semibold text-ink cursor-pointer transition-colors hover:bg-ink/12"
						>Retry</button>
					</div>
				) : notes.length === 0 ? (
					<div className="h-[420px] flex items-center justify-center text-ink/40 text-[13px]">No notes yet.</div>
				) : nodes.length === 0 ? (
					<div className="h-[420px] flex flex-col items-center justify-center gap-2 text-center px-6">
						<p className="text-[13.5px] text-ink/60 font-medium">No linked notes yet</p>
						<p className="text-[12px] text-ink/40 max-w-[360px]">
							Type <code className="text-ink/60 bg-ink/8 px-1 py-0.5 rounded">[[</code> in a note and pick another note to connect them — linked notes show up here as a graph. All your notes are listed below in the meantime.
						</p>
					</div>
				) : (
					<svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-[420px]">
						<g>
							{links.map((l, i) => {
								const source = nodes.find((n) => n.id === (l.source.id ?? l.source))
								const target = nodes.find((n) => n.id === (l.target.id ?? l.target))
								if (!source || !target) return null
								const dimmed = hoveredId && source.id !== hoveredId && target.id !== hoveredId
								return (
									<line
										key={i}
										x1={source.x} y1={source.y}
										x2={target.x} y2={target.y}
										stroke="currentColor"
										className={dimmed ? 'text-ink/6' : 'text-accent/35'}
										strokeWidth={1.5}
									/>
								)
							})}
						</g>
						<g>
							{nodes.map((n) => {
								const dimmed = hoveredNeighborIds && !hoveredNeighborIds.has(n.id)
								const radius = 7 + Math.min(n.degree, 6) * 1.8
								return (
									<g
										key={n.id}
										transform={`translate(${n.x}, ${n.y})`}
										onMouseEnter={() => setHoveredId(n.id)}
										onMouseLeave={() => setHoveredId(null)}
										onClick={() => openNote(n.id)}
										className="cursor-pointer"
										opacity={dimmed ? 0.25 : 1}
									>
										<circle r={radius} fill={folderColor(n.folder)} stroke="color-mix(in srgb, var(--color-ink) 35%, transparent)" strokeWidth={1.5} />
										<text
											y={-radius - 6}
											textAnchor="middle"
											className={`text-[11px] font-semibold ${hoveredId === n.id ? 'fill-ink' : 'fill-ink/70'}`}
											style={{paintOrder: 'stroke', stroke: 'var(--color-ink-deep)', strokeWidth: 3}}
										>
											{n.title.length > 28 ? `${n.title.slice(0, 28)}…` : n.title}
										</text>
									</g>
								)
							})}
						</g>
					</svg>
				)}
			</div>

			{unlinkedNotes.length > 0 && (
				<div className="flex flex-col gap-2.5">
					<h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">
						Not yet linked ({unlinkedNotes.length})
					</h2>
					<div className="flex flex-wrap gap-2">
						{unlinkedNotes.map((n) => (
							<button
								key={n._id}
								onClick={() => openNote(n._id)}
								className="flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[12px] text-ink/70 bg-ink/6 border border-ink/12 cursor-pointer transition-colors duration-150 hover:bg-ink/10 hover:text-ink"
							>
								<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: folderColor(n.folder)}} />
								{n.title}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export default GraphView
