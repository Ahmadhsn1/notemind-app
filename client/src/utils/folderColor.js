// A decorative, categorical palette for telling folders apart at a glance —
// deliberately separate from the semantic accent/growth/amber tokens in
// index.css, so collapsing those to a smaller set (see the Momentum
// redesign) doesn't reduce how many distinct folder colors are available.
const PALETTE = [
	'#5b78ff',
	'#35d0a5',
	'#9a7bff',
	'#4fb8e0',
	'#e0a955',
	'#e0839f',
]

export function folderColor(name) {
	if (!name) return PALETTE[0]
	let hash = 0
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) >>> 0
	}
	return PALETTE[hash % PALETTE.length]
}
