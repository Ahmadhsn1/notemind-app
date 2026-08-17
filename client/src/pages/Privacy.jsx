import LegalPageLayout from '../components/LegalPageLayout'

// Public, unauthenticated route — see App.jsx. Content is written to match
// what this codebase actually does (see CLAUDE.md), not generic boilerplate:
// update this page for real whenever a data-handling change lands (a new
// third-party service, a new AI feature, etc.), not just on a schedule.
// No advertising/AdSense — that idea was considered and dropped (see
// Terms.jsx's matching note) — don't reintroduce ad-related language here
// without both files being updated together again.
function Privacy() {
	return (
		<LegalPageLayout title="Privacy Policy" updated="August 17, 2026">
			<p>
				NoteMind ("we", "us") is a free note-taking application. This page explains what
				information we collect, how we use it, and the choices you have. If anything here is
				unclear, email us at <a href="mailto:notemind.ai.app@gmail.com">notemind.ai.app@gmail.com</a>.
			</p>

			<h2>Information we collect</h2>
			<ul>
				<li><strong>Account information:</strong> your name and email address, plus a password (stored only as a salted hash, never in plain text) — or, if you sign in with Google, the name and email Google shares with us and no password at all.</li>
				<li><strong>Your content:</strong> the notes, tags, folders, reminders, and flashcards you create, and any images you upload, so we can store and display them back to you.</li>
				<li><strong>Basic usage data:</strong> timestamps like your last login, used only to run the product (e.g. showing you're signed in) and, for admin accounts, aggregate signup/activity counts.</li>
			</ul>

			<h2>How we use Google Gemini (AI features)</h2>
			<p>
				Features like auto-tagging, "Ask your notes", semantic search, title suggestions, writing
				assist, and flashcard generation send the relevant note content to Google's Gemini API to
				generate a response. This only happens when you actively use one of these features. Google
				processes that content under its own API terms and privacy policy; we don't control how
				Google's infrastructure handles it beyond what those terms specify.
			</p>

			<h2>Cookies</h2>
			<p>
				The app itself doesn't use tracking or advertising cookies — your login session is a token
				stored in your browser's local storage, sent only to our own server.
			</p>

			<h2>Who we share information with</h2>
			<p>We use a small number of service providers to run NoteMind, each only for the purpose below. We never sell your data, and we don't run advertising of any kind.</p>
			<ul>
				<li><strong>MongoDB Atlas</strong> — hosts our database (your account and note data).</li>
				<li><strong>Cloudflare R2</strong> — stores images you upload into notes.</li>
				<li><strong>Google</strong> — Gemini (AI features) and Google Sign-In (optional login method).</li>
				<li><strong>Gmail / Resend</strong> — sends transactional email (e.g. password reset), never marketing email.</li>
				<li><strong>Sentry</strong> — receives error reports (stack traces, request metadata) when something breaks, so we can fix it.</li>
			</ul>

			<h2>Data retention and deletion</h2>
			<p>
				We keep your data for as long as your account exists. You can export everything you've
				written at any time (JSON or Markdown, from the Account page), and you can permanently
				delete your account yourself — this immediately and irreversibly removes your notes, note
				versions, and flashcards along with your account.
			</p>

			<h2>Security</h2>
			<p>
				Passwords are hashed with bcrypt and never stored or logged in plain text. Sessions use
				signed JWTs. Note content is sanitized before storage and again before display to guard
				against malicious markup.
			</p>

			<h2>Children's privacy</h2>
			<p>NoteMind is not directed at children under 13, and we don't knowingly collect information from them.</p>

			<h2>Your rights</h2>
			<p>
				You can access, export, correct, or delete your data at any time from the Account page. For
				anything the app's self-service tools don't cover, email us and we'll help directly.
			</p>

			<h2>Changes to this policy</h2>
			<p>If this policy changes in a way that matters, we'll update the date at the top of this page.</p>

			<h2>Contact</h2>
			<p>Questions about this policy: <a href="mailto:notemind.ai.app@gmail.com">notemind.ai.app@gmail.com</a>.</p>
		</LegalPageLayout>
	)
}

export default Privacy
