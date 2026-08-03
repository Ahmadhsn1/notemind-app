import Image from '@tiptap/extension-image'
import {signUploadUrls} from '../../api/axios'

// The stored `src` attribute must always stay the server's relative
// /uploads/... path — server/utils/htmlSanitizer.js's UPLOAD_IMAGE_SRC_PATTERN
// only allows that exact shape, and a resolved absolute URL leaking into
// contentHtml (e.g. via renderHTML) would get stripped on the very next
// save. This custom node view resolves the URL only for the live editing
// DOM, leaving the underlying attrs/serialization untouched.
//
// Resolution is asynchronous now that images require a short-lived signed URL
// (see server/services/imageSignature.js): the element is created immediately
// with the natural src for non-upload images, and upload paths are filled in
// when signing returns. `destroyed` guards the late assignment — a node view
// can be torn down (the user closes the editor, or edits the node) before the
// request resolves.
export const noteImageExtension = Image.extend({
	addNodeView() {
		return ({node}) => {
			const dom = document.createElement('img')
			if (node.attrs.alt) dom.alt = node.attrs.alt
			if (node.attrs.title) dom.title = node.attrs.title
			dom.style.maxWidth = '100%'
			dom.style.borderRadius = '8px'

			const src = node.attrs.src
			let destroyed = false

			if (src?.startsWith('/uploads/')) {
				signUploadUrls([src]).then((signed) => {
					const url = signed.get(src)
					if (!destroyed && url) dom.src = url
				})
			} else if (src) {
				dom.src = src
			}

			return {
				dom,
				destroy() { destroyed = true },
			}
		}
	},
})
