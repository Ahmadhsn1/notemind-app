import Image from '@tiptap/extension-image'
import {resolveUploadUrl} from '../../api/axios'

// The stored `src` attribute must always stay the server's relative
// /uploads/... path — server/utils/htmlSanitizer.js's UPLOAD_IMAGE_SRC_PATTERN
// only allows that exact shape, and a resolved absolute URL leaking into
// contentHtml (e.g. via renderHTML) would get stripped on the very next
// save. This custom node view resolves the URL only for the live editing
// DOM, leaving the underlying attrs/serialization untouched.
export const noteImageExtension = Image.extend({
	addNodeView() {
		return ({node}) => {
			const dom = document.createElement('img')
			dom.src = resolveUploadUrl(node.attrs.src)
			if (node.attrs.alt) dom.alt = node.attrs.alt
			if (node.attrs.title) dom.title = node.attrs.title
			dom.style.maxWidth = '100%'
			dom.style.borderRadius = '8px'
			return {dom}
		}
	},
})
