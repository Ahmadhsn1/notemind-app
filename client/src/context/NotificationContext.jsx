import {createContext, useContext, useEffect, useState} from 'react'
import {io} from 'socket.io-client'
import api, {API_ORIGIN, getAuthToken} from '../api/axios'
import {useAuth} from './AuthContext'
import {useToast} from './ToastContext'

const NotificationContext = createContext()

// Owns the one socket connection every logged-in user (not just admins) now
// gets — see server/services/socket.js's per-user room join — plus the
// notification list/unread count so the bell (TopBar) and the toast-on-
// arrival behavior below share one source of truth instead of each
// maintaining their own fetch/socket.
export const NotificationProvider = ({children}) => {
	const {user} = useAuth()
	const toast = useToast()
	const [notifications, setNotifications] = useState([])

	useEffect(() => {
		let ignore = false
		let socket

		;(async () => {
			if (!user) {
				setNotifications([])
				return
			}

			try {
				const res = await api.get('/notifications')
				if (!ignore) setNotifications(res.data)
			} catch {
				// Best-effort — the bell just shows nothing until the next mount/tick.
			}

			// StrictMode's dev-only double-invoke runs this effect, its cleanup,
			// then this effect again — the cleanup can fire while still paused at
			// the `await` above, before `socket` has been assigned, so
			// `socket?.disconnect()` there is a no-op and a second socket would
			// otherwise get created after cleanup already ran, leaking a
			// duplicate listener (every event then fires twice). Bailing out
			// here if cleanup already happened avoids that.
			if (ignore) return

			socket = io(API_ORIGIN, {auth: {token: getAuthToken()}})
			socket.on('notification:new', (notification) => {
				setNotifications((prev) => [notification, ...prev])
				toast.show(notification.message, {type: 'info'})
			})
		})()

		return () => {
			ignore = true
			socket?.disconnect()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is stable (useCallback in ToastContext); only user identity should reset this
	}, [user?._id])

	const markRead = async (id) => {
		setNotifications((prev) => prev.map((n) => (n._id === id ? {...n, read: true} : n)))
		try {
			await api.patch(`/notifications/${id}/read`)
		} catch {
			// Best-effort — a failed mark-read isn't worth surfacing an error for;
			// worst case it just shows unread again next time the list refetches.
		}
	}

	const unreadCount = notifications.filter((n) => !n.read).length

	return (
		<NotificationContext.Provider value={{notifications, unreadCount, markRead}}>
			{children}
		</NotificationContext.Provider>
	)
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook intentionally share this file, matches AuthContext/ToastContext convention
export const useNotifications = () => useContext(NotificationContext)
