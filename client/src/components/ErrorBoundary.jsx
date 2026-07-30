import {Component} from 'react'
import Logo from './Logo'

// Class component because React only supports the getDerivedStateFromError/
// componentDidCatch lifecycle via classes — there's no hook equivalent.
// Catches render/lifecycle errors anywhere below it in the tree so a bug in
// one page (e.g. a bad note payload crashing NoteViewModal) shows a
// recoverable screen instead of a blank white page.
class ErrorBoundary extends Component {
	constructor(props) {
		super(props)
		this.state = {hasError: false}
	}

	static getDerivedStateFromError() {
		return {hasError: true}
	}

	componentDidCatch(error, info) {
		console.error('Unhandled render error:', error, info)
	}

	handleReload = () => {
		this.setState({hasError: false})
		window.location.assign('/dashboard')
	}

	render() {
		if (!this.state.hasError) return this.props.children

		return (
			<div className="flex justify-center items-center min-h-screen p-5">
				<div className="w-full max-w-[420px] rounded-[20px] border border-ink/15 bg-ink/7 backdrop-blur-[18px] p-8 flex flex-col items-center text-center gap-3">
					<Logo size={28} textSize="text-[24px]" />
					<h1 className="text-base font-bold mt-2">Something went wrong</h1>
					<p className="text-[13px] text-ink/55 leading-[1.5]">
						This page hit an unexpected error. Your notes are safe — reloading usually fixes it.
					</p>
					<button onClick={this.handleReload} className="btn-primary self-stretch py-3 text-[13.5px] mt-2">
						Back to dashboard
					</button>
				</div>
			</div>
		)
	}
}

export default ErrorBoundary
