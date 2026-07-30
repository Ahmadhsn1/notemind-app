import {createContext, useCallback, useContext, useRef, useState} from 'react'

const ToastContext = createContext()

const DEFAULT_DURATION = 3500

export const ToastProvider = ({children}) => {
	const [toasts, setToasts] = useState([])
	const nextId = useRef(0)

	const dismiss = useCallback((id) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	const show = useCallback((message, {type = 'info', duration = DEFAULT_DURATION} = {}) => {
		const id = nextId.current++
		setToasts((prev) => [...prev, {id, message, type}])
		if (duration > 0) {
			setTimeout(() => dismiss(id), duration)
		}
		return id
	}, [dismiss])

	const toast = {
		show,
		success: (message, options) => show(message, {...options, type: 'success'}),
		error: (message, options) => show(message, {...options, type: 'error'}),
		dismiss,
	}

	return (
		<ToastContext.Provider value={{toasts, ...toast}}>
			{children}
		</ToastContext.Provider>
	)
}

// eslint-disable-next-line react-refresh/only-export-components -- matches the existing AuthContext.jsx convention
export const useToast = () => useContext(ToastContext)
