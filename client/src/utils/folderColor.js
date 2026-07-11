const PALETTE = ['#6c5ce7', '#e84393', '#00cec9', '#fdcb6e', '#a29bfe', '#a55eea']

export function folderColor(name) {
	if (!name) return PALETTE[0]
	let hash = 0
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) >>> 0
	}
	return PALETTE[hash % PALETTE.length]
}
