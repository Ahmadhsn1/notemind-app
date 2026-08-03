import {signUploadUrls} from '../api/axios'

// Note images need a server-signed URL before they can load (see
// api/axios.js's signUploadUrls and server/services/imageSignature.js), and
// signing is a network call — but the HTML is rendered synchronously.
//
// So it happens in two phases: `withPendingImages` runs during render and
// parks each upload src on a data attribute behind a transparent placeholder,
// then `withSignedImages` runs in an effect and swaps in the real URLs. The
// placeholder is what stops a note briefly rendering a column of broken-image
// icons every time it opens.
const TRANSPARENT_GIF =
	'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

const parse = (html) => new DOMParser().parseFromString(html, 'text/html')

export const hasUploadImages = (html) => Boolean(html) && html.includes('/uploads/')

export const withPendingImages = (html) => {
	if (!hasUploadImages(html)) return html
	const doc = parse(html)
	doc.querySelectorAll('img[src^="/uploads/"]').forEach((img) => {
		img.setAttribute('data-upload-src', img.getAttribute('src'))
		img.setAttribute('src', TRANSPARENT_GIF)
	})
	return doc.body.innerHTML
}

export const withSignedImages = async (html) => {
	if (!html || !html.includes('data-upload-src')) return html

	const doc = parse(html)
	const images = [...doc.querySelectorAll('img[data-upload-src]')]
	if (images.length === 0) return html

	const signed = await signUploadUrls(images.map((img) => img.getAttribute('data-upload-src')))

	images.forEach((img) => {
		const original = img.getAttribute('data-upload-src')
		const url = signed.get(original)
		// An unresolved entry (signing failed, or the file isn't ours) keeps the
		// placeholder rather than falling back to an unsigned URL that could
		// only 403.
		if (url) img.setAttribute('src', url)
		img.removeAttribute('data-upload-src')
	})

	return doc.body.innerHTML
}
