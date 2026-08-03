// Operational visibility — Gemini key-pool health and rate-limit config.
// Rate limits are shown as STATIC configuration only: express-rate-limit
// doesn't expose a stable public API to read live per-IP hit counts back
// out of its in-memory store, so there is deliberately no "requests
// remaining" figure here — that would have to be faked.
function AdminSystemPanel({system, error, onRetry}) {
	// A failed fetch is distinct from one still in flight — without this the
	// panel showed "Loading…" indefinitely after an error, with the only
	// signal being a toast that had already disappeared.
	if (error && !system) {
		return (
			<div className="h-[160px] flex flex-col items-center justify-center gap-3 text-center">
				<p className="text-[13px] text-ink/50">Could not load system status.</p>
				<button
					onClick={onRetry}
					className="py-2 px-4 rounded-[10px] bg-ink/8 border border-ink/15 text-[12.5px] font-semibold text-ink cursor-pointer transition-colors hover:bg-ink/12"
				>Retry</button>
			</div>
		)
	}

	if (!system) {
		return <div className="h-[160px] flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
	}

	const rateLimitRows = [
		['Auth', system.rateLimits.auth],
		['AI', system.rateLimits.ai],
		['Upload', system.rateLimits.upload],
	]

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">Gemini key pool</h2>
					<span className="text-[11px] text-ink/40">{system.geminiPool.size} key{system.geminiPool.size === 1 ? '' : 's'} configured</span>
				</div>
				<div className="rounded-[14px] border border-ink/12 bg-ink/4 divide-y divide-ink/6">
					{system.geminiPool.keys.map((k) => (
						<div key={k.label} className="flex items-center justify-between gap-3 py-2.5 px-3.5 text-[12.5px]">
							<span className="text-ink/75 font-medium">{k.label}</span>
							{k.available ? (
								<span className="py-[3px] px-2.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.04em] bg-growth/15 text-growth">Available</span>
							) : (
								<span className="py-[3px] px-2.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.04em] bg-danger/15 text-danger-light">
									Cooling down{k.cooldownUntil ? ` until ${new Date(k.cooldownUntil).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}` : ''}
								</span>
							)}
						</div>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">Rate limits (config)</h2>
				<div className="grid grid-cols-1 min-[560px]:grid-cols-3 gap-3">
					{rateLimitRows.map(([label, cfg]) => (
						<div key={label} className="rounded-[14px] border border-ink/12 bg-ink/4 p-3.5 flex flex-col gap-1">
							<span className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink/45">{label}</span>
							<span className="text-[15px] font-bold tabular-nums">{cfg.limit} <span className="text-ink/40 font-normal text-[11px]">/ {Math.round(cfg.windowMs / 60000)}min</span></span>
							<span className="text-[11px] text-ink/40">{cfg.scope}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default AdminSystemPanel
